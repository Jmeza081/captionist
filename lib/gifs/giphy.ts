import type { GifResult } from './types'

/**
 * The only place the Giphy key is read.
 *
 * Server-side by construction: the key is a full-capability credential, so it
 * never reaches the browser — the client talks to `/api/gifs`, which talks to
 * Giphy. Same shape the Ably token route will take in phase 5.
 */

const ENDPOINT = 'https://api.giphy.com/v1/gifs'

/** The brief clock is 30s. A hung request must not eat it. */
const TIMEOUT_MS = 4_000

export interface GiphyQuery {
  q?: string
  limit: number
  offset: number
}

export class GiphyError extends Error {}

interface GiphyImage {
  url?: string
  mp4?: string
  webp?: string
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
  }
}

export async function searchGiphy(query: GiphyQuery, apiKey: string): Promise<GifResult[]> {
  const term = query.q?.trim()
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(query.limit),
    offset: String(query.offset),
    // Unconditional, never a setting: the picker promises "SFW filter on", and
    // that promise is only honest if nothing can raise it.
    rating: 'pg-13',
    lang: 'en',
    bundle: 'messaging_non_clips',
  })
  if (term) params.set('q', term)

  const url = `${ENDPOINT}/${term ? 'search' : 'trending'}?${params.toString()}`

  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Everyone in the room searches the same handful of terms, and the
    // suggestion chips are the hot path.
    next: { revalidate: 3_600 },
  })

  if (!response.ok) {
    throw new GiphyError(`Giphy answered ${response.status}`)
  }

  const body = (await response.json()) as { data?: GiphyItem[] }
  return (body.data ?? []).flatMap((item) => {
    const result = toResult(item, term)
    return result ? [result] : []
  })
}
