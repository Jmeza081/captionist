import { searchGiphy } from './giphy'
import { SAMPLE_GIFS } from './samples'
import { readLevers } from '@/lib/room/levers'
import type { GifSearchResponse } from './types'

/**
 * Which shelf a board comes from, resolved in one place.
 *
 * This is what `/api/gifs` used to decide before it was deleted for proxying
 * (see `giphy.ts`). The three ways in are unchanged, because CI and a fresh
 * clone both depend on them:
 *
 *   - `NEXT_PUBLIC_GIFS_STUB=1` — sticky, for a day spent on layout.
 *   - `?gifs=stub` — the URL lever, already gated to non-production by
 *     `readLevers`, so it cannot leak into a deployed build.
 *   - no key at all, outside production — a fresh clone should render a
 *     working picker before it renders an error.
 *
 * **The two shelves never mix.** Giphy's terms forbid blending their grid with
 * another provider's, so samples *replace* a board rather than topping one up.
 * That is why this returns a whole response and not a list to merge.
 */

/** Giphy's documented ceiling, and Klipy's. Asking for more is an error there. */
export const MAX_LIMIT = 50

function sampleResponse(query: string, offset: number): GifSearchResponse {
  const q = query.trim().toLowerCase()
  const matched = q
    ? SAMPLE_GIFS.filter((gif) => gif.keywords.some((word) => word.includes(q)))
    : SAMPLE_GIFS
  // A search that matches nothing still returns the shelf rather than an empty
  // grid: there are only twelve of these, and a blank picker reads as broken.
  const results = matched.length > 0 ? matched : SAMPLE_GIFS
  return { results: [...results], offset: offset + results.length, query, source: 'sample' }
}

/**
 * The URL lever beats the environment, in both directions.
 *
 * `?gifs=stub` turns the shelf on and `?gifs=live` turns it back off, which is
 * the relationship `docs/architecture.md` has always claimed this pair has —
 * and `?transport=` genuinely has with `ABLY_STUB`. It did not hold here:
 * whoever set `GIFS_STUB=1` won unconditionally, so `?gifs=live` was a lever
 * that read as understood and did nothing. `readLevers` is already gated to
 * non-production, so neither direction exists in a deployed build.
 */
function stubbed(): boolean {
  if (typeof window !== 'undefined') {
    const lever = readLevers(new URLSearchParams(window.location.search)).gifs
    if (lever) return lever === 'stub'
  }
  return process.env.NEXT_PUBLIC_GIFS_STUB === '1'
}

/**
 * One board.
 *
 * Throws whatever `searchGiphy` throws — including `GiphyRateLimitError`,
 * which the caller has to tell apart from an ordinary failure.
 */
export async function fetchBoard(
  query: string,
  offset: number,
  limit: number,
): Promise<GifSearchResponse> {
  // Referenced as a full literal, not destructured: `NEXT_PUBLIC_*` is inlined
  // at build time by name, and a dynamic read would come back undefined.
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY
  const production = process.env.NODE_ENV === 'production'

  if (stubbed() || (!apiKey && !production)) {
    return sampleResponse(query, offset)
  }

  if (!apiKey) {
    throw new Error('GIF search isn’t configured. Set NEXT_PUBLIC_GIPHY_API_KEY and rebuild.')
  }

  const results = await searchGiphy(
    { q: query, limit: Math.min(limit, MAX_LIMIT), offset },
    apiKey,
  )
  return { results, offset: offset + results.length, query, source: 'giphy' }
}
