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
