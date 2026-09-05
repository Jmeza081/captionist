import { budgetFrames, DEFAULT_DELAY_MS, normaliseDelay } from './budget'
import type { FailureReason } from './types'

/**
 * A picture's frames, one at a time, whatever the picture is.
 *
 * Two roads in. A GIF is fetched and decoded here — `gifuct-js`, one frame at
 * a time, composited onto a screen with the file's own disposal rules — so the
 * caption can be drawn over every frame. Anything else (the offline shelf's
 * SVGs, a provider's still, a GIF too broken to parse) becomes one frame via
 * an `<img>`, which is also the only road the test suite can take: it blocks
 * every host but loopback and the shelf is SVG.
 *
 * Nothing is kept. The bytes arrive from the provider's CDN with
 * `access-control-allow-origin: *`, are decoded in this tab, and are gone
 * when the export is — no cache, no store, no second host. See ADR 0036.
 */

export class ExportError extends Error {
  constructor(
    public readonly reason: FailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'ExportError'
  }
}

export interface SourceFrame {
  image: CanvasImageSource
  delay: number
}

export interface Source {
  width: number
  height: number
  /** How many frames `frames()` will yield, after budgeting. */
  count: number
  animated: boolean
  frames: () => AsyncGenerator<SourceFrame, void, undefined>
}

const GIF_MAGIC = 'GIF8'

function isGif(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength))
  return String.fromCharCode(...head) === GIF_MAGIC
}

function canvas(width: number, height: number): HTMLCanvasElement {
  const el = document.createElement('canvas')
  el.width = Math.max(1, width)
  el.height = Math.max(1, height)
  return el
}

function context(el: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = el.getContext('2d')
  if (!ctx) throw new ExportError('render', 'export: no 2d context')
  return ctx
}

export async function loadSource(
  src: string,
  hint?: { width?: number; height?: number },
): Promise<Source> {
  let bytes: ArrayBuffer | undefined
  try {
    const response = await fetch(src, { mode: 'cors', credentials: 'omit' })
    if (response.ok) bytes = await response.arrayBuffer()
  } catch {
    // A refused CORS request or a dead link. The `<img>` road below may still
    // have it — the browser's image cache is not the fetch cache.
  }

  if (bytes && isGif(bytes)) {
    try {
      return await gifSource(bytes)
    } catch {
      // A GIF the decoder could not read is still a picture the browser can
      // show. Fall through to one frame of it.
    }
  }

  return stillSource(src, bytes, hint)
}

/**
 * Every frame of a GIF, composited the way a player would.
 *
 * The file is parsed once (that holds the compressed blocks, roughly the
 * file's own size) and each frame is decompressed as it is reached, so memory
 * is one patch and one screen rather than every frame at once. Disposal is
 * honoured per frame: `2` clears the previous frame's own rectangle, `3`
 * restores what was under it. The demo's `clearRect(0, 0, w, h)` is wrong for
 * a sub-rectangle frame and this is not that.
 *
 * Budgeting decides which frames are *yielded*; every frame is still
 * composited, because a skipped frame's disposal still happened.
 */
async function gifSource(bytes: ArrayBuffer): Promise<Source> {
  const { parseGIF, decompressFrame } = await import('gifuct-js')
  const gif = parseGIF(bytes)
  const width = gif.lsd.width
  const height = gif.lsd.height
  if (width <= 0 || height <= 0) throw new ExportError('render', 'export: GIF has no size')

  type ImageFrame = Extract<(typeof gif.frames)[number], { image: unknown }>
  const imageFrames = gif.frames.filter((f): f is ImageFrame => 'image' in f)
  if (imageFrames.length === 0) throw new ExportError('render', 'export: GIF has no frames')

  const timed = imageFrames.map((frame, index) => ({
    index,
    delay: normaliseDelay(frame.gce ? (frame.gce.delay || 10) * 10 : DEFAULT_DELAY_MS),
  }))
  const kept = budgetFrames(timed)
  const delayFor = new Map(kept.map((f) => [f.index, f.delay]))

  return {
    width,
    height,
    count: kept.length,
    animated: kept.length > 1,
    async *frames() {
      const screen = canvas(width, height)
      const ctx = context(screen)
      const patchCanvas = canvas(1, 1)
      const patchCtx = context(patchCanvas)

      let previous: { dims: { left: number; top: number; width: number; height: number }; disposal: number } | undefined
      let saved: ImageData | undefined

      for (const [i, frame] of imageFrames.entries()) {
        const decoded = decompressFrame(frame, gif.gct, true)

        if (previous) {
          if (previous.disposal === 2) {
            ctx.clearRect(previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height)
          } else if (previous.disposal === 3 && saved) {
            ctx.putImageData(saved, previous.dims.left, previous.dims.top)
          }
        }
        saved =
          decoded.disposalType === 3
            ? ctx.getImageData(decoded.dims.left, decoded.dims.top, decoded.dims.width, decoded.dims.height)
            : undefined

        if (decoded.dims.width > 0 && decoded.dims.height > 0) {
          patchCanvas.width = decoded.dims.width
          patchCanvas.height = decoded.dims.height
          // A copy into a fresh buffer: the decoder's array is typed over
          // `ArrayBufferLike`, and `ImageData` insists on a real `ArrayBuffer`.
          const pixels = new Uint8ClampedArray(decoded.patch)
          patchCtx.putImageData(new ImageData(pixels, decoded.dims.width, decoded.dims.height), 0, 0)
          // `drawImage`, not `putImageData`: a transparent pixel has to show
          // what is already on the screen, and `putImageData` overwrites it.
          ctx.drawImage(patchCanvas, decoded.dims.left, decoded.dims.top)
        }

        previous = { dims: decoded.dims, disposal: decoded.disposalType }

        const delay = delayFor.get(i)
        if (delay !== undefined) yield { image: screen, delay }
      }
    },
  }
}

/**
 * One frame of whatever the browser can draw.
 *
 * From the fetched bytes where there are some (a blob URL is same-origin, so
 * the canvas stays clean), else straight from the URL with `crossOrigin` set,
 * which is the last road for a host that refused `fetch` but serves images.
 * Never `createImageBitmap`: Chrome refuses an SVG blob there, and the shelf
 * is SVG.
 */
async function stillSource(
  src: string,
  bytes: ArrayBuffer | undefined,
  hint?: { width?: number; height?: number },
): Promise<Source> {
  const image = await loadImage(src, bytes)
  const width = image.naturalWidth || hint?.width || 480
  const height = image.naturalHeight || hint?.height || 480
  return {
    width,
    height,
    count: 1,
    animated: false,
    async *frames() {
      yield { image, delay: DEFAULT_DELAY_MS }
    },
  }
}

async function loadImage(src: string, bytes: ArrayBuffer | undefined): Promise<HTMLImageElement> {
  if (bytes) {
    const url = URL.createObjectURL(new Blob([bytes]))
    try {
      return await decodeImage(url, false)
    } catch {
      // Not something an <img> can show from bytes alone; try the URL.
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  try {
    return await decodeImage(src, true)
  } catch {
    throw new ExportError('source', `export: could not load ${src}`)
  }
}

function decodeImage(url: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cors) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image failed'))
    img.src = url
  })
}
