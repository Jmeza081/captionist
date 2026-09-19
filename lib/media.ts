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
 * What makes two `MediaRef`s the same GIF.
 *
 * `MediaRef` carries no id — `src` is the only key, and it is not uniformly
 * stable. Klipy's is a bare CDN URL and compares cleanly; Giphy's carries
 * per-request `?cid=…&rid=…` parameters, so two players who searched
 * separately hold byte-different strings for one GIF. Everything after the
 * path is dropped, which is origin + pathname without asking `URL` to parse a
 * relative shelf path.
 */
export function mediaKey(src: string): string {
  return src.split(/[?#]/, 1)[0] ?? src
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

/**
 * How many characters a line of caption holds, in the overlay's own type.
 *
 * Twenty is measured against the 800-weight uppercase sans the overlay is set
 * in, not guessed: at 8cqw an average glyph advances about 0.55em, so a card
 * fits `1 / (0.08 * 0.55)` ≈ 22 of them, less the padding either side. It
 * lives here rather than in `theme/_metrics.scss` because no stylesheet can
 * read it — a token nothing consumes is a number that drifts from the one that
 * runs. It is still a property of `$media-overlay-size`, so changing that type
 * means re-measuring this.
 */
export const CHARS_PER_LINE = 20

/**
 * Which type step a caption needs, from its length alone.
 *
 * No measuring, and therefore no effect, no ref and no `'use client'`: the
 * overlay is sized in `cqw`, so a card holds about the same number of
 * characters per line whatever its pixel width, and the line count falls out of
 * the character count. Capped at the fourth step, which is where `CAPTION_MAX`
 * lands.
 *
 * Shared by `MediaCard`, which turns the step into a class, and the export
 * renderer, which turns it into a font size — one rule, so a caption exported
 * is set the way it was shown.
 */
export function captionLines(text: string): 1 | 2 | 3 | 4 {
  const lines = Math.ceil(text.trim().length / CHARS_PER_LINE)
  if (lines <= 1) return 1
  if (lines === 2) return 2
  if (lines === 3) return 3
  return 4
}
