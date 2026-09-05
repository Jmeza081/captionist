/**
 * How big an export is allowed to be.
 *
 * A Klipy `md` rendition is anything up to five megabytes and a couple of
 * hundred frames, and re-encoding it happens on whatever phone tapped the key.
 * These are the numbers that keep that to a few seconds, and they are pure so
 * a test can pin them. Memory is handled elsewhere: `frames.ts` decodes one
 * frame at a time rather than all of them at once.
 */

/** The widest an export is drawn. A source narrower than this is never upscaled. */
export const EXPORT_WIDTH = 480

/** The most frames an export keeps. Past this, every Nth is dropped. */
export const MAX_FRAMES = 100

/**
 * The floor under a frame delay, in milliseconds.
 *
 * Browsers already treat anything under 20ms as 100ms — a thirty-year-old
 * quirk — so a delay below it would not play as authored anywhere. Writing it
 * as the floor keeps the file honest about what it will look like.
 */
export const MIN_DELAY_MS = 20

/** What a frame with no delay, or a zero one, plays at. The browsers' convention. */
export const DEFAULT_DELAY_MS = 100

/** A delay as a player would honour it. */
export function normaliseDelay(ms: number | undefined): number {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return DEFAULT_DELAY_MS
  return Math.max(MIN_DELAY_MS, ms)
}

export interface ExportSize {
  /** The factor the source is drawn at; 1 when it already fits. */
  scale: number
  width: number
  height: number
}

/**
 * The size a source is drawn at: its own, or shrunk to fit the export width.
 *
 * Never upscaled — a 300px GIF blown up to 480 is a worse file than the
 * 300px one, and the caption scales with the card either way.
 */
export function exportScale(width: number, height: number, max = EXPORT_WIDTH): ExportSize {
  if (width <= 0 || height <= 0) return { scale: 1, width: Math.max(1, width), height: Math.max(1, height) }
  const scale = Math.min(1, max / width)
  return {
    scale,
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * The frames an export keeps, and how long each one plays for.
 *
 * Every Nth frame survives, where N is the smallest stride that brings the
 * count under the cap, and a kept frame inherits the delays of the frames
 * dropped after it — so the animation keeps its length and its pace, at a
 * lower frame rate. Delays are normalised first, so a dropped zero-delay frame
 * is counted as the 100ms a player would have shown it for.
 */
export function budgetFrames<T extends { delay: number }>(
  frames: readonly T[],
  max = MAX_FRAMES,
): readonly T[] {
  const normalised = frames.map((frame) => ({ ...frame, delay: normaliseDelay(frame.delay) }))
  if (normalised.length <= max) return normalised

  const stride = Math.ceil(normalised.length / max)
  const kept: T[] = []
  for (let i = 0; i < normalised.length; i += stride) {
    const run = normalised.slice(i, i + stride)
    const delay = run.reduce((sum, frame) => sum + frame.delay, 0)
    const head = run[0]
    if (head) kept.push({ ...head, delay })
  }
  return kept
}
