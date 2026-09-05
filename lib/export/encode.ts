import type { Palette } from 'gifenc'
import type { Progress } from './types'

/**
 * RGBA frames in, a GIF out — slowly enough to be interrupted.
 *
 * `gifenc` is a per-frame API (`quantize` → `applyPalette` → `writeFrame`),
 * which is why it was chosen over encoders that take every frame and return
 * a file: between frames this yields to the event loop, so the key's label
 * can count and a tap elsewhere still lands. One global palette, built from
 * a sample of *composed* frames — so the caption's white, the bands' greys
 * and the provider's picture all have entries — rather than one per frame:
 * three to five times faster, a smaller file, and no palette flicker.
 */

export interface EncodeFrame {
  rgba: Uint8ClampedArray
  delay: number
}

/** Every `stride`th pixel, as whole RGBA pixels the quantizer can read. */
export function samplePixels(rgba: Uint8ClampedArray, stride = 4): Uint8ClampedArray {
  const pixels = Math.floor(rgba.length / 4)
  const count = Math.ceil(pixels / stride)
  const out = new Uint8ClampedArray(count * 4)
  for (let i = 0, o = 0; i < pixels; i += stride, o += 4) {
    const p = i * 4
    out[o] = rgba[p] ?? 0
    out[o + 1] = rgba[p + 1] ?? 0
    out[o + 2] = rgba[p + 2] ?? 0
    out[o + 3] = rgba[p + 3] ?? 255
  }
  return out
}

/** Which of `total` frames to sample for the palette: up to `n`, evenly spaced. */
export function sampleIndices(total: number, n = 8): Set<number> {
  if (total <= n) return new Set(Array.from({ length: total }, (_, i) => i))
  const picked = new Set<number>()
  for (let k = 0; k < n; k++) picked.add(Math.floor((k * (total - 1)) / (n - 1)))
  return picked
}

export async function buildPalette(samples: readonly Uint8ClampedArray[]): Promise<Palette> {
  const { quantize } = await import('gifenc')
  const length = samples.reduce((sum, s) => sum + s.length, 0)
  const all = new Uint8ClampedArray(length)
  let offset = 0
  for (const s of samples) {
    all.set(s, offset)
    offset += s.length
  }
  return quantize(all, 256, { format: 'rgb565', oneBitAlpha: false })
}

/** Hand the thread back for a moment. A channel post lands sooner than a timer. */
export function breathe(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(undefined)
  })
}

function abortError(): DOMException {
  return new DOMException('export aborted', 'AbortError')
}

export async function encodeGif(
  size: { width: number; height: number },
  total: number,
  frames: AsyncIterable<EncodeFrame>,
  palette: Palette,
  onProgress: (progress: Progress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const { GIFEncoder, applyPalette } = await import('gifenc')
  const gif = GIFEncoder()
  let done = 0
  onProgress({ done, total })

  for await (const frame of frames) {
    if (signal?.aborted) throw abortError()
    const index = applyPalette(frame.rgba, palette, 'rgb565')
    gif.writeFrame(index, size.width, size.height, {
      ...(done === 0 ? { palette, repeat: 0 } : {}),
      delay: frame.delay,
    })
    done += 1
    onProgress({ done, total })
    await breathe()
  }

  gif.finish()
  const bytes = gif.bytesView()
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' })
}
