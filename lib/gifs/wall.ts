import { GiphyError, searchGiphy } from './giphy'
import { SAMPLE_GIFS } from './samples'

/**
 * The landing page's GIF wall, resolved on the server.
 *
 * Fetched here rather than in the browser on purpose: the page is a Server
 * Component, so the wall arrives in the first HTML with its sizes already
 * known. A client-side fetch would mean an empty grid on first paint, a
 * waterfall behind hydration, and layout shift when the tiles land.
 *
 * The result is cached for an hour by the fetch in `searchGiphy`, so the wall
 * costs one upstream call per hour for everybody, not one per visitor.
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

export async function wallTiles(count = WALL_SIZE): Promise<WallTile[]> {
  const apiKey = process.env.GIPHY_API_KEY
  const stubbed = process.env.GIFS_STUB === '1'

  if (!apiKey || stubbed) return fromSamples(count)

  try {
    const results = await searchGiphy({ q: 'reaction', limit: count, offset: 0 }, apiKey)
    const tiles = results.map((gif) => ({
      id: gif.id,
      poster: gif.still ?? gif.src,
      mp4: gif.mp4,
      // Only when there is no video: a wall of twenty GIFs is the thing this
      // whole design is avoiding.
      motion: gif.mp4 ? undefined : gif.src,
      alt: gif.alt,
    }))
    // A short answer still fills the wall rather than leaving holes in it.
    return tiles.length >= count ? tiles : [...tiles, ...fromSamples(count - tiles.length)]
  } catch (error) {
    // The landing page is the first thing anyone sees. It renders with the
    // offline shelf rather than not rendering.
    if (!(error instanceof GiphyError)) console.error('[wall] giphy failed', error)
    return fromSamples(count)
  }
}
