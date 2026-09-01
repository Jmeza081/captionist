import { SAMPLE_GIFS } from './samples'
import { readLevers } from '@/lib/room/levers'
import { firstPage, type GifCursor, type GifProviderId } from './provider'
import { intendedProvider, keyFor, selectProvider } from './registry'
import { GifQuotaError } from './errors'
import { recordCall } from './usage'
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
 *
 * It also now decides *whose* board it is. `?gifs=giphy` / `?gifs=klipy` pin a
 * provider; otherwise the registry picks. See ADR-0022.
 */

/** The largest board any provider here will serve. Each one clamps its own. */
export const MAX_LIMIT = 50

function sampleResponse(
  query: string,
  cursor: GifCursor,
): GifSearchResponse {
  const q = query.trim().toLowerCase()
  const matched = q
    ? SAMPLE_GIFS.filter((gif) => gif.keywords.some((word) => word.includes(q)))
    : SAMPLE_GIFS
  // A search that matches nothing still returns the shelf rather than an empty
  // grid: there are only twelve of these, and a blank picker reads as broken.
  const results = matched.length > 0 ? matched : SAMPLE_GIFS
  // The offline shelf is ours: no advertising, and no second page to turn to.
  return { results: [...results], ads: [], cursor, query, source: 'sample', hasMore: false }
}

/** What the URL asked for, if anything. Non-production only, via `readLevers`. */
function lever(): 'stub' | 'live' | GifProviderId | undefined {
  if (typeof window === 'undefined') return undefined
  return readLevers(new URLSearchParams(window.location.search)).gifs
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
 *
 * Naming a provider means the same thing as `live` — you cannot pin the shelf
 * to a provider, because the shelf is nobody's.
 */
export function stubbed(): boolean {
  const value = lever()
  if (value) return value === 'stub'
  return process.env.NEXT_PUBLIC_GIFS_STUB === '1'
}

function pinned(): GifProviderId | undefined {
  const value = lever()
  return value === 'giphy' || value === 'klipy' ? value : undefined
}

/**
 * One board.
 *
 * Throws whatever the provider throws — including `GifQuotaError`, which the
 * caller has to tell apart from an ordinary failure.
 */
export async function fetchBoard(
  query: string,
  cursor: GifCursor | undefined,
  limit: number,
): Promise<GifSearchResponse> {
  const pin = pinned()
  const provider = selectProvider(pin)
  const production = process.env.NODE_ENV === 'production'

  if (stubbed() || (!provider && !production)) {
    return sampleResponse(query, cursor ?? firstPage(pin ?? 'giphy'))
  }

  if (!provider) {
    throw new Error(intendedProvider(pin).descriptor.missingKeyMessage)
  }

  const { descriptor } = provider
  // A cursor minted against one provider is meaningless to another, so a pinned
  // switch mid-session starts over rather than asking for page N of a stranger.
  const from =
    cursor && cursor.provider === descriptor.id ? cursor : firstPage(descriptor.id)

  const apiKey = keyFor(descriptor.id)
  if (!apiKey) throw new Error(descriptor.missingKeyMessage)

  /**
   * The one place a board is counted.
   *
   * Every adapter comes through here, and the count happens around the call
   * rather than inside any of them — so a provider added later is measured
   * without having to remember to be. A call that threw is still counted,
   * because a 429 spends the allowance exactly as much as a board that arrived;
   * that is the whole reason the ledger exists. See `usage.ts`.
   */
  const kind = query.trim() ? 'search' : 'trending'
  try {
    const board = await provider.search(
      { q: query, limit: Math.min(limit, descriptor.maxLimit), cursor: from },
      apiKey,
    )
    recordCall(descriptor.id, kind, 'ok')

    return {
      results: [...board.items],
      ads: board.ads,
      cursor: { provider: descriptor.id, page: from.page + 1 },
      query,
      source: descriptor.id,
      hasMore: board.hasMore,
    }
  } catch (error) {
    recordCall(descriptor.id, kind, error instanceof GifQuotaError ? 'quota' : 'failed')
    throw error
  }
}

/**
 * Tell the provider a GIF was chosen, if it wants to know.
 *
 * Klipy's attribution depends on this signal and Giphy asks for none, so it is
 * optional on the contract and a no-op for a provider without one. It has to
 * fire at pick time: `toMediaRef` drops the id a moment later, and the id is
 * what the trigger takes.
 */
export function reportPick(source: GifSearchResponse['source'], id: string, query: string): void {
  if (source === 'sample') return
  const provider = selectProvider(pinned())
  if (!provider || provider.descriptor.id !== source || !provider.share) return
  const apiKey = keyFor(source)
  if (!apiKey) return
  provider.share(id, apiKey, query || undefined)
  recordCall(source, 'share', 'ok')
}
