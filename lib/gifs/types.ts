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
  /**
   * The same animation as video, when the source has one.
   *
   * A GIF is the wrong format for anything showing many at once — an MP4 of
   * the same clip is roughly a tenth the bytes and decodes on the video path
   * instead of the main thread. The picker still uses `src`, because one
   * animation in a grid you are reading is cheap; the landing wall runs twenty
   * at once and uses these.
   */
  mp4?: string
  webp?: string
  /** A single frame. What a paused or reduced-motion viewer sees. */
  still?: string
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
 * `id` and `keywords` are dropped on purpose: `MediaRef` has no id, and the
 * room has no use for the search terms that surfaced a GIF.
 */
export function toMediaRef(gif: GifResult): MediaRef {
  return { src: gif.src, alt: gif.alt }
}
