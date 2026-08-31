import type { GifResult } from './types'

/**
 * The contract a GIF source has to satisfy.
 *
 * The app used to depend on Giphy: the client, the key's name, the attribution
 * string, the host allowlist and a persisted room setting all said so. That was
 * survivable while there was one plausible provider, and it stopped being
 * survivable when the thing capping this room turned out to be one vendor's
 * free tier rather than anything about GIFs. See ADR-0022.
 *
 * Types only in here, and data only in `descriptors.ts`. Neither imports a
 * client, because `allow.ts` needs the descriptors on the event lane's hot path
 * and must not drag `fetch` code in with them.
 */

export type GifProviderId = 'giphy' | 'klipy'

/**
 * Where a board came from.
 *
 * `sample` is the offline shelf — it is not a provider and must never be
 * credited as one, which is the whole reason this is wider than `GifProviderId`.
 */
export type BoardSource = GifProviderId | 'sample'

/**
 * A page position, provider-agnostic and counted from zero.
 *
 * Neither paging model leaks past this: Giphy takes `offset = page * limit` and
 * Klipy takes `page + 1` in its 1-based `page`. The provider owns that
 * arithmetic because the provider is the only thing that knows which model it
 * is in — a caller that knew would be a caller that breaks on the swap.
 *
 * `provider` rides along so a cursor minted against one source can never be
 * spent against another. Nothing pages today (ADR-0021 deleted "Shuffle
 * results"), but `useGifSearch` still threads the position through, and this is
 * the shape it will want back.
 */
export interface GifCursor {
  readonly provider: GifProviderId
  readonly page: number
}

export function firstPage(provider: GifProviderId): GifCursor {
  return { provider, page: 0 }
}

export function nextPage(cursor: GifCursor): GifCursor {
  return { provider: cursor.provider, page: cursor.page + 1 }
}

export interface GifQuery {
  /** Empty means trending. */
  readonly q: string
  /** Tiles wanted. `fetchBoard` clamps this to `descriptor.maxLimit`. */
  readonly limit: number
  readonly cursor: GifCursor
}

/**
 * An advertisement, which is not a GIF and is not shaped like one.
 *
 * Klipy returns ads inline in the same array as the tiles, and they carry
 * neither a slug nor a `file` — just a size and `content`, which is a complete
 * HTML document with its own stylesheet, click-through and script.
 *
 * It rides a separate field rather than joining `items` for one reason that is
 * worth more than tidiness: an ad must be structurally incapable of becoming a
 * `MediaRef`. Nothing that reads `items` can reach this, so no pick, no
 * auto-pick and no "surprise me" can ever put an advertiser's HTML into game
 * state. That is a guarantee the compiler makes rather than a rule anyone has
 * to remember.
 */
export interface GifAd {
  /** A whole HTML document. Rendered in a sandboxed iframe, never inlined. */
  readonly content: string
  readonly width: number
  readonly height: number
}

export interface GifBoard {
  /** In the provider's own order, with nothing reordered or removed. */
  readonly items: readonly GifResult[]
  /**
   * Whatever ads came back, in the order they came.
   *
   * Empty is the ordinary case and the one the app is designed around: ads are
   * only delivered to a request that asks, delivery is never guaranteed even
   * then, and no money here depends on one arriving.
   */
  readonly ads: readonly GifAd[]
}

/**
 * A host this provider's media may be served from.
 *
 * `exact` pins the hostname; without it, subdomains of `host` are allowed too.
 * Giphy spreads media across `media0..4.giphy.com` and wants the loose form;
 * a provider that publishes a closed list of hosts should be pinned, because a
 * suffix match would admit anything they ever put on that domain later.
 */
export interface MediaHost {
  readonly host: string
  readonly exact?: boolean
}

/**
 * Everything about a provider that is not a network call.
 *
 * The strings live here rather than in `GifPanel` so that attribution is a
 * property of *whose content is on screen* rather than something each new board
 * has to remember. ADR-0020 moved the mark into the component for that reason;
 * this moves it one step further, to the only place that knows the answer.
 */
export interface GifProviderDescriptor {
  readonly id: GifProviderId
  /** The brand, spelled the way the provider spells it. */
  readonly name: string
  /** The search field's placeholder. Some providers mandate the exact wording. */
  readonly searchPlaceholder: string
  /** The board's mark. Both providers require one where the API is used. */
  readonly attribution: string
  /** The popover's compact mark. */
  readonly attributionCompact: string
  /** The board ceiling: Giphy's `limit`, Klipy's `per_page`. */
  readonly maxLimit: number
  /** Hosts this provider's media may come from. Unioned by `allow.ts`. */
  readonly mediaHosts: readonly MediaHost[]
  /**
   * The ad shape this provider should be asked for, if it serves ads at all.
   *
   * Absent means never ask — and never asking is what keeps a provider's
   * results unfiltered without a client-side filter, because nothing but GIFs
   * is returned in the first place.
   *
   * The numbers are a layout fact: the picker's narrowest column is
   * `$gif-board-min` on a phone, so an ad is requested small enough to sit
   * there at its natural size. Klipy caps rescaling at ten percent
   * (`meta.ad_max_resize_percent`), and an iframe's fixed content clips rather
   * than scales, so asking for something that already fits is the only way to
   * render one honestly.
   */
  readonly adSizes?: {
    readonly minWidth: number
    readonly maxWidth: number
    readonly minHeight: number
    readonly maxHeight: number
  }
  /** Said when the offline shelf stands in because this provider has no key. */
  readonly sampleFallbackMessage: string
  /** Said in production when this provider is selected and has no key. */
  readonly missingKeyMessage: string
}

export interface GifProvider {
  readonly descriptor: GifProviderDescriptor
  /**
   * One board.
   *
   * Throws `GifQuotaError` when the allowance is spent and `GifProviderError`
   * for anything else. Never returns a partial board — a caller has no way to
   * tell a short page from a spent one.
   */
  search(query: GifQuery, apiKey: string): Promise<GifBoard>
  /**
   * Tell the provider one of its GIFs was chosen.
   *
   * Optional, because only some providers want to hear about it — Giphy's terms
   * ask for no such signal and Klipy's attribution depends on one. Returns
   * nothing and is never awaited: a picker that failed because an analytics
   * ping did would be the wrong trade, so a caller cannot accidentally block on
   * it or handle its errors.
   */
  share?(id: string, apiKey: string, query?: string): void
}
