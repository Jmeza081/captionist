import { SAMPLE_GIFS } from './samples'

/**
 * The landing page's GIF wall, as the server can draw it.
 *
 * **What the server sends is the app's own art**, every time. The real GIFs
 * arrive afterwards: `HeroWall` resolves `WALL_SLUGS` in the browser and swaps
 * them in.
 *
 * It has been three things. It searched Giphy from the server, which was a
 * proxy and blended two providers in one grid. Then it drew twenty committed
 * `media.giphy.com` URLs, which was neither — but Klipy's terms rule that out
 * too: the API request must come from a browser, and a media URL must not be
 * retained. A committed URL also keeps serving content the provider has since
 * pulled, which is the moderation risk the whole no-cache rule exists for.
 *
 * So the catalog is gone and only the slugs are kept. See `art.ts` and ADR-0025.
 *
 * **One shelf or the other, never a mix.** Both providers forbid blending their
 * grid with another's, so the wall is wholly resolved art or wholly ours.
 */
export interface WallTile {
  id: string
  /**
   * A single frame. Always present, always what a paused or reduced-motion
   * viewer sees, and the video's poster — so the wall is complete and
   * correctly sized in the first HTML whether or not anything ever plays.
   */
  poster: string
  /** The animation as video. Preferred: a tenth the bytes of the equivalent GIF. */
  mp4?: string
  /** The animation as an image, for sources that have no video. */
  motion?: string
  alt: string
}

/**
 * Twenty is the design's five columns by four rows — and on a phone the same
 * twenty turned on its side, four by five.
 *
 * It is a hard count, not a floor: `HeroWall`'s grid declares exactly that
 * many tracks, so twenty tiles fill it precisely at every viewport. Change it
 * here and the track counts in `theme/_metrics.scss` have to change with it.
 */
const WALL_SIZE = 20

function fromSamples(count: number): WallTile[] {
  return Array.from({ length: count }, (_, i) => {
    const gif = SAMPLE_GIFS[i % SAMPLE_GIFS.length]
    return {
      // The shelf is shorter than the wall, so ids have to be made unique or
      // React sees duplicate keys.
      id: `${gif?.id ?? 'sample'}-${i}`,
      poster: gif?.still ?? gif?.src ?? '',
      motion: gif?.src,
      alt: gif?.alt ?? '',
    }
  })
}

/**
 * Fill the wall from however many tiles there are, repeating if short.
 *
 * Twenty slugs against a wall that wants more, and a resolve that may return
 * fewer than it asked for — a pulled GIF simply is not in the answer. Cycling
 * keeps the wall full either way.
 */
export function cycleTiles(tiles: readonly WallTile[], count: number): WallTile[] {
  if (tiles.length === 0) return []
  return Array.from({ length: count }, (_, i) => {
    const tile = tiles[i % tiles.length] as WallTile
    // Ids have to stay unique or React sees duplicate keys, the same reason
    // `fromSamples` suffixes its own.
    return { ...tile, id: `${tile.id}-${i}` }
  })
}

/**
 * Still `async`, and deliberately so.
 *
 * Nothing here awaits any more, but all four callers are `async` Server
 * Components that `await` it, and the day the wall wants a live source again
 * it should not be a signature change rippling through every front door.
 */
export async function wallTiles(count = WALL_SIZE): Promise<WallTile[]> {
  // Always the app's own art. Nothing a server renders may come from a
  // provider any more, and this is what a visitor sees before — or instead of —
  // the real thing.
  return fromSamples(count)
}

/**
 * A resolved GIF, in the shape the wall draws.
 *
 * `poster` is required and `still` is not, so a source without one falls back
 * to its own animation rather than leaving the tile unsized in the first paint.
 */
export function toWallTile(gif: {
  id: string
  src: string
  alt: string
  mp4?: string
  still?: string
}): WallTile {
  return { id: gif.id, poster: gif.still ?? gif.src, mp4: gif.mp4, alt: gif.alt }
}
