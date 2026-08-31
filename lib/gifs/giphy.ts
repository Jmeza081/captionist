import { GifProviderError, GifQuotaError } from './errors'
import { GIPHY } from './descriptors'
import type { GifBoard, GifProvider, GifQuery } from './provider'
import type { GifResult } from './types'

/**
 * Giphy, called from the browser.
 *
 * **This used to be a server module behind `/api/gifs`, and the terms forbid
 * that.** Giphy's API requirements are explicit on both counts:
 *
 *   > Do not proxy requests to GIPHY, either API calls or media URL loads.
 *   > All requests to GIPHY should be made directly from the client side.
 *
 *   > Do not cache media URLs or copies of GIPHY media assets unless your
 *   > integration has been explicitly approved.
 *
 * So the proxy is gone and so is the hour-long `next: { revalidate }` on the
 * fetch below. The key travels to the browser as
 * `NEXT_PUBLIC_GIPHY_API_KEY`, which is Giphy's own model — they tell you to
 * issue a separate key per platform precisely because it ships to clients. It
 * is rate-limited, not secret. See ADR-0020.
 *
 * The cost of losing the cache is the whole reason the room is capped at ten
 * players and a competitor gets two boards a round — see ADR-0021.
 *
 * This is now one `GifProvider` among others rather than *the* client. Nothing
 * about how Giphy is called changed — the terms above did not — but the module
 * no longer names itself in the app's error types or its attribution strings.
 * Those moved to `errors.ts` and `descriptors.ts`. See ADR-0022.
 */

const ENDPOINT = 'https://api.giphy.com/v1/gifs'

/** The brief clock is 30s. A hung request must not eat it. */
const TIMEOUT_MS = 4_000

interface GiphyImage {
  url?: string
  mp4?: string
  webp?: string
  // Giphy sends these as decimal strings, not numbers.
  width?: string
  height?: string
}

interface GiphyItem {
  id?: string
  title?: string
  alt_text?: string
  images?: {
    fixed_width?: GiphyImage
    fixed_width_still?: GiphyImage
    original?: GiphyImage
  }
}

/** Giphy's dimensions arrive as strings. A missing or junk one is simply absent. */
function size(raw: string | undefined): number | undefined {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** Titles are noisy; this is enough for the panel's local narrowing. */
function keywordsFor(title: string, query: string | undefined): string[] {
  const words = `${query ?? ''} ${title}`
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length > 1)
  return [...new Set(words)]
}

/** The first of these that actually says something. */
function firstWords(...candidates: (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function toResult(item: GiphyItem, query: string | undefined): GifResult | undefined {
  const rendition = item.images?.fixed_width ?? item.images?.original
  const src = rendition?.url ?? item.images?.original?.url
  if (!item.id || !src) return undefined

  // Never empty: this becomes the accessible name here, the vote card's `alt`,
  // and `MediaRef.alt` in game state for the rest of the round.
  //
  // First *non-empty* of the two, not first present. Giphy sends
  // `alt_text: ''` on most results rather than omitting it, so `??` never
  // reaches `title` and every GIF in the app was called "A GIF" — including to
  // a screen reader, and including the one the whole round is about.
  const alt = firstWords(item.alt_text, item.title) ?? 'A GIF'

  return {
    id: item.id,
    src,
    alt,
    keywords: keywordsFor(alt, query),
    mp4: rendition?.mp4,
    webp: rendition?.webp,
    still: item.images?.fixed_width_still?.url,
    // Off the same rendition `src` came from, so the ratio describes the image
    // actually being rendered rather than the original it was resized from.
    width: size(rendition?.width),
    height: size(rendition?.height),
  }
}

async function search(query: GifQuery, apiKey: string): Promise<GifBoard> {
  const term = query.q.trim()
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(query.limit),
    // Giphy counts items, not pages. The cursor counts pages, so the
    // arithmetic happens here — that is the whole point of keeping it opaque.
    offset: String(query.cursor.page * query.limit),
    // Unconditional, never a setting: the picker promises "SFW filter on", and
    // that promise is only honest if nothing can raise it.
    rating: 'pg-13',
    lang: 'en',
    bundle: 'messaging_non_clips',
  })
  if (term) params.set('q', term)

  const url = `${ENDPOINT}/${term ? 'search' : 'trending'}?${params.toString()}`

  // No `next: { revalidate }`, and nothing else that would retain a copy: the
  // terms allow neither. Every board is a live request.
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })

  if (response.status === 429) {
    throw new GifQuotaError('Giphy\u2019s hourly limit is spent', 'giphy')
  }

  if (!response.ok) {
    throw new GifProviderError(`Giphy answered ${response.status}`, 'giphy')
  }

  const body = (await response.json()) as { data?: GiphyItem[] }
  /**
   * Giphy's order, kept.
   *
   * The terms say not to "reorder, insert, remove, suppress, replace, or
   * filter" what search and trending return, so this maps in place and the
   * only thing it drops is an item with no `id` or no usable image URL —
   * which is not a filter on content but a tile that cannot be drawn. Nothing
   * downstream re-sorts: `GifPanel` renders `results` in the order it gets
   * them, and its local narrowing is off whenever `onSubmit` is supplied.
   */
  const items = (body.data ?? []).flatMap((item) => {
    const result = toResult(item, term)
    return result ? [result] : []
  })

  return { items }
}

export const giphyProvider: GifProvider = { descriptor: GIPHY, search }
