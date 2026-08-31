import { SAMPLE_GIFS } from './samples'
import { WALL_GIFS } from './wall.catalog'

/**
 * The landing page's GIF wall — real Giphy, hot-linked, never the API.
 *
 * **This used to search Giphy from the server, and three separate things were
 * wrong with that.**
 *
 * It was a proxy: "all requests to GIPHY should be made directly from the
 * client side". It topped a short answer up with samples, blending two
 * providers in one grid, which the same terms forbid. And it was only
 * affordable because `searchGiphy` cached for an hour — one upstream call
 * served everybody. That cache is gone (caching their URLs is also
 * prohibited), which would have made this one call per visitor, on the four
 * highest-traffic routes in the app, against an allowance of a hundred an
 * hour. The landing page would have spent the room's whole budget on people
 * who never joined a room.
 *
 * The fix keeps the GIFs and drops the request. `wall.catalog.ts` holds
 * hot-linked `media.giphy.com` URLs — the sanctioned way to show their media,
 * and what `backdrop.ts` and `notFound.ts` already do — resolved here on the
 * server so the grid arrives in the first HTML with its sizes already known.
 * No key, no network, no quota, and the wall is the product demo the design
 * asked for rather than twelve house SVGs on repeat.
 *
 * **One shelf or the other, never a mix.** Giphy's terms forbid blending their
 * grid with another provider's, so a short catalog *cycles* to fill the wall
 * and an empty one falls through to the offline shelf whole.
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

/** Cycled, because the catalog is allowed to be shorter than the wall. */
function fromCatalog(count: number): WallTile[] {
  return Array.from({ length: count }, (_, i) => {
    const tile = WALL_GIFS[i % WALL_GIFS.length]
    // Ids have to stay unique or React sees duplicate keys, the same reason
    // `fromSamples` suffixes its own.
    return { ...(tile as WallTile), id: `${tile?.id ?? 'wall'}-${i}` }
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
  // The same switch the picker reads, so one flag keeps every surface off a
  // third party — a keyless clone, and the Playwright suite, which resolves no
  // host but the dev server and would otherwise draw twenty broken tiles.
  const stubbed = process.env.NEXT_PUBLIC_GIFS_STUB === '1'
  if (stubbed || WALL_GIFS.length === 0) return fromSamples(count)
  return fromCatalog(count)
}

/** Whether the wall is showing Giphy's art, so the page can credit it. */
export function wallIsGiphy(): boolean {
  return process.env.NEXT_PUBLIC_GIFS_STUB !== '1' && WALL_GIFS.length > 0
}
