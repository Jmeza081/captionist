import { exportScale } from './budget'
import { applyTracking, composeFrame } from './compose'
import { buildPalette, encodeGif, sampleIndices, samplePixels, type EncodeFrame } from './encode'
import { ExportError, loadSource } from './frames'
import { font, fontFamily, loadFonts, overlayPxAt, paint } from './fonts'
import { layout, type MemeSpec } from './layout'
import type { Progress } from './types'

/**
 * A meme, as a file: the picture, the caption, the credit.
 *
 * The pipeline is `frames → compose → encode`, run twice over the source. The
 * first pass composes a handful of evenly spaced frames and builds one palette
 * from them; the second composes every kept frame, maps it onto that palette
 * and writes it. Decoding twice is cheap next to quantising once, and it means
 * no frame is ever held for later — memory is one source frame and one
 * composed frame, however long the clip.
 *
 * Nothing is stored anywhere: the bytes come from the provider's CDN into
 * this tab and leave as a `Blob` the caller hands to the share sheet, the
 * clipboard or a download. ADR 0036.
 */

export interface MemeJob {
  src: string
  /** Everything but the picture's size, which the source itself reports. */
  spec: Omit<MemeSpec, 'media'>
  /** `MediaRef`'s size, for a source that does not report one. */
  hint?: { width?: number; height?: number }
}

/**
 * A meme, and a still one rather than none.
 *
 * The animated path asks a phone to decode, composite and re-encode a hundred
 * frames, and a phone can refuse — a canvas it will not allocate, a
 * `getImageData` that throws once memory is tight. That surfaced as
 * "Couldn't render that GIF" on Android while desktop was fine, which is the
 * worst trade available: the whole feature lost to the last frame of a long
 * animation.
 *
 * So a failure retries once at a single frame. The picture, the caption and
 * the credit all survive; only the movement is given up, and only when the
 * device could not have had it anyway. Anything that throws twice is a real
 * failure and is reported as one.
 */
export async function renderMeme(
  job: MemeJob,
  onProgress: (progress: Progress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  try {
    return await draw(job, onProgress, signal)
  } catch (error) {
    if (signal?.aborted || (error instanceof ExportError && error.reason === 'source')) throw error
    console.error('[export] animated render failed; retrying as a still frame', error)
    return draw(job, onProgress, signal, 1)
  }
}

async function draw(
  job: MemeJob,
  onProgress: (progress: Progress) => void,
  signal?: AbortSignal,
  maxFrames?: number,
): Promise<Blob> {
  const family = fontFamily()
  await loadFonts(family)

  const source = await loadSource(job.src, job.hint, maxFrames)
  if (signal?.aborted) throw new DOMException('export aborted', 'AbortError')

  const size = exportScale(source.width, source.height)
  const stage = document.createElement('canvas')
  const context = stage.getContext('2d', { willReadFrequently: true })
  if (!context) throw new ExportError('render', 'export: no 2d context')
  // Narrowed once, so the generator below closes over a context and not a maybe.
  const ctx: CanvasRenderingContext2D = context

  const measure = (text: string, fontPx: number, weight: number): number => {
    ctx.font = font(weight, fontPx, family)
    applyTracking(ctx, weight)
    return ctx.measureText(text).width
  }

  const spec: MemeSpec = { ...job.spec, media: { width: source.width, height: source.height } }
  const plan = layout(spec, { width: size.width, overlayPx: overlayPxAt(size.width), measure })
  stage.width = plan.width
  stage.height = plan.height
  const colours = paint()

  // Pass one: the palette.
  const wanted = sampleIndices(source.count)
  const samples: Uint8ClampedArray[] = []
  let i = 0
  for await (const frame of source.frames()) {
    if (wanted.has(i)) {
      composeFrame(ctx, frame.image, plan, colours, family)
      samples.push(samplePixels(ctx.getImageData(0, 0, plan.width, plan.height).data))
    }
    i += 1
    if (signal?.aborted) throw new DOMException('export aborted', 'AbortError')
  }
  const palette = await buildPalette(samples)

  // Pass two: every frame, through it.
  async function* composed(): AsyncGenerator<EncodeFrame> {
    for await (const frame of source.frames()) {
      composeFrame(ctx, frame.image, plan, colours, family)
      yield { rgba: ctx.getImageData(0, 0, plan.width, plan.height).data, delay: frame.delay }
    }
  }

  return encodeGif({ width: plan.width, height: plan.height }, source.count, composed(), palette, onProgress, signal)
}
