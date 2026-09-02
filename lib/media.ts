/**
 * A 1×1 transparent GIF.
 *
 * DESIGNSYSTEM.md §5: an empty `src` makes the browser refetch the *page* and
 * fire a spurious error, so an image with nothing to show points here instead.
 *
 * This is a rendering detail and never reaches `GameState` — the no-data-URI
 * invariant in `lib/game/types.ts` is about what gets broadcast, and a
 * `MediaRef` still stores a URL or nothing.
 */
export const BLANK =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** A `src` that is safe to hand an `<img>`. */
export function imageSrc(src: string | undefined): string {
  return src && src.length > 0 ? src : BLANK
}

/** Whether there is really an image, as opposed to a placeholder standing in. */
export function hasImage(src: string | undefined): boolean {
  return typeof src === 'string' && src.length > 0
}

/**
 * The band a card's shape is allowed to take.
 *
 * A meme is roughly square, and the design draws every card that way — but a
 * GIF is any ratio it likes, and `object-fit: cover` on a 16:9 photo forced
 * into a square shows 56% of the frame. Half the joke is usually in the other
 * half.
 *
 * So: the image's own ratio, clamped. The clamp is what keeps a vote grid a
 * grid — unbounded, one 9:16 tile beside one 16:9 tile is a 3× spread in
 * height and the rows stop reading as rows. Inside 4:5 → 4:3 a wide photo
 * shows three quarters of itself instead of a half, a tall one is never a
 * column, and the row heights stay within a third of each other.
 */
export const MEDIA_ASPECT_MIN = 4 / 5
export const MEDIA_ASPECT_MAX = 4 / 3

/**
 * The ratio to draw a piece of media at, or `undefined` if it never said.
 *
 * `undefined` rather than a default, so the fallback lives in one place — the
 * CSS — instead of being a number two files could disagree about.
 */
export function mediaAspect(
  size?: { width?: number; height?: number },
  /**
   * Clamping is for a *grid*. Set this false where the media is not in one.
   *
   * The band above earns its keep by keeping rows reading as rows — that
   * argument needs rows. Sudden death draws two cards and nothing else, so a
   * 16:9 still has no neighbour to be out of step with, and cropping a quarter
   * of the frame off the only two things on the screen buys nothing.
   */
  clamp = true,
): number | undefined {
  const { width, height } = size ?? {}
  if (!width || !height || width <= 0 || height <= 0) return undefined
  const ratio = width / height
  if (!clamp) return ratio
  return Math.min(MEDIA_ASPECT_MAX, Math.max(MEDIA_ASPECT_MIN, ratio))
}
