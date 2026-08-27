import type { MediaRef } from '@/lib/game/types'

/**
 * A search result, on its way to becoming a `MediaRef`.
 *
 * Declared here rather than in `GifPanel` so the API route can import it: a
 * route handler reaching into `components/` would be the wrong direction, and
 * `lib` is what both sides are allowed to depend on.
 */
export interface GifResult {
  id: string
  src: string
  alt: string
  /** Lowercased words the panel filters a fetched page against. */
  keywords: string[]
}

export interface GifSearchResponse {
  results: GifResult[]
  /** Echoed back so "Shuffle results" can ask for the next page. */
  offset: number
  query: string
  /** `sample` means offline art, not Giphy. The picker says so. */
  source: 'giphy' | 'sample'
}

/**
 * The adapter between what a picker returns and what the room stores.
 *
 * `id` and `keywords` are dropped on purpose: `MediaRef` has no id, and giving
 * one to every uploaded image later would mean inventing one.
 */
export function toMediaRef(gif: GifResult): MediaRef {
  return { src: gif.src, alt: gif.alt, source: 'giphy' }
}
