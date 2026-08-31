import type { MediaRef } from '@/lib/game/types'
import type { BoardSource, GifCursor } from './provider'

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
  /**
   * The intrinsic size of `src`, when the source reports one.
   *
   * Carried so a picker can reserve each tile's real shape *before* the image
   * arrives. A GIF is any ratio it likes — Giphy's `fixed_width` rendition
   * pins the width at 200 and lets the height fall where it may — so a grid of
   * fixed-height tiles crops every one of them, and a grid that waits for the
   * image to size itself reflows on every load.
   *
   * `toMediaRef` carries it into `MediaRef` — the vote card is drawn at the
   * image's own ratio now, so this stopped being only a picker hint. `id` and
   * `keywords` are still dropped there; they are the picker's alone.
   *
   * Optional because plenty of sources report nothing, and one that does still
   * renders — at the picker's fallback height, and at the card's square.
   */
  width?: number
  height?: number
}

export interface GifSearchResponse {
  results: GifResult[]
  /**
   * Where the next page would start.
   *
   * Opaque, and provider-minted: Giphy counts items and Klipy counts pages, and
   * a caller that knew which would break on the swap. Nothing asks for a second
   * page today — ADR-0021 deleted "Shuffle results" — but the position is still
   * threaded through, and this is the shape it will want back.
   */
  cursor: GifCursor
  query: string
  /**
   * Who supplied these tiles.
   *
   * `sample` means offline art and is not a provider: the picker must never
   * credit anyone over the shelf. That is why this is wider than a provider id.
   */
  source: BoardSource
}

/**
 * The adapter between what a picker returns and what the room stores.
 *
 * `id` and `keywords` are dropped on purpose: `MediaRef` has no id, and the
 * room has no use for the search terms that surfaced a GIF.
 */
export function toMediaRef(gif: GifResult): MediaRef {
  return { src: gif.src, alt: gif.alt, width: gif.width, height: gif.height }
}
