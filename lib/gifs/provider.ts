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

export interface GifBoard {
  /** In the provider's own order, with nothing reordered or removed. */
  readonly items: readonly GifResult[]
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
}
