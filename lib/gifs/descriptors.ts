import type { BoardSource, GifProviderDescriptor, GifProviderId } from './provider'

/**
 * Who the providers are, as data.
 *
 * **No `fetch` in this file, and nothing that imports one.** `allow.ts` reads
 * the media hosts from here, and `allow.ts` is called by `lib/room/events.ts`
 * on every inbound event — so this module sits on a hot path that has no
 * business pulling an HTTP client into the bundle behind it.
 */

/**
 * Giphy.
 *
 * Every string is the one that was hardcoded in `GifPanel`, `useGifSearch` and
 * `source.ts` before the seam existed, character for character. Moving them
 * must not move a pixel or a test assertion.
 */
export const GIPHY: GifProviderDescriptor = {
  id: 'giphy',
  name: 'Giphy',
  /**
   * The popover's placeholder.
   *
   * The *board* uses an example query — `deploy on friday` — rather than a
   * "search X" prompt, because at page scale the field is obviously a search
   * field and the example teaches what to type. That is a design choice this
   * descriptor deliberately does not own yet: a provider that mandates its own
   * placeholder wording would take the example away, and that is a question for
   * the design pass rather than something to settle by widening this type.
   */
  searchPlaceholder: 'Search Giphy…',
  attribution: 'Powered by Giphy · SFW filter on',
  attributionCompact: 'via Giphy',
  /** Giphy's documented ceiling. Asking for more is an error there. */
  maxLimit: 50,
  /**
   * Loose, not exact: Giphy spreads renditions across `media0..4.giphy.com`,
   * and the committed wall catalog is full of them.
   */
  mediaHosts: [{ host: 'giphy.com' }],
  sampleFallbackMessage: 'Showing samples — no Giphy key configured.',
  missingKeyMessage:
    'GIF search isn’t configured. Set NEXT_PUBLIC_GIPHY_API_KEY and rebuild.',
}

/**
 * Klipy.
 *
 * Every value here was read off a live response on 2026-08-31, not from
 * documentation — `docs.klipy.com` was unreachable while this was written, and
 * a descriptor built from guesses is exactly the thing `DESCRIPTORS` being
 * `Partial` existed to prevent.
 */
export const KLIPY: GifProviderDescriptor = {
  id: 'klipy',
  name: 'KLIPY',
  /**
   * Mandated wording, not a preference.
   *
   * Klipy's attribution terms fix the search field's placeholder as exactly
   * this string. It is the one required mark — the others are recommended —
   * so it is the one that must not drift.
   */
  searchPlaceholder: 'Search KLIPY',
  attribution: 'Powered by KLIPY · SFW filter on',
  attributionCompact: 'via KLIPY',
  /**
   * A hundred, and it clamps rather than complaining.
   *
   * Asking for 500 returns 200 with `per_page: 100` and a hundred items, so
   * unlike Giphy — where the ceiling is an error — nothing here would tell you
   * that you had asked for the impossible. The board still asks for fifty; this
   * is the ceiling, not the request.
   */
  maxLimit: 100,
  /**
   * Three hosts, pinned exactly.
   *
   * Only `static.klipy.com` appeared across 2,144 sampled URLs, but Klipy's
   * published network requirements list `static1` and `static2` as well and
   * they load-balance across all three — a third-party post-mortem exists of
   * someone allowing only the first and having most results silently vanish.
   * So all three are allowed and none of them loosely: a suffix match on
   * `.klipy.com` would admit whatever they host there next.
   */
  mediaHosts: [
    { host: 'static.klipy.com', exact: true },
    { host: 'static1.klipy.com', exact: true },
    { host: 'static2.klipy.com', exact: true },
  ],
  sampleFallbackMessage: 'Showing samples — no KLIPY key configured.',
  missingKeyMessage:
    'GIF search isn’t configured. Set NEXT_PUBLIC_KLIPY_API_KEY and rebuild.',
}

/**
 * Every provider the app knows about, selected or not.
 *
 * `allow.ts` unions the media hosts across *all* of these rather than just the
 * one this build selected, and that is load-bearing: a `MediaRef` is persisted
 * game state, so a room resumed across a provider change — or a tab still
 * running an older bundle — can carry the other provider's URL into this one.
 * Gating the allowlist on the active provider would turn that into a broken
 * image that nobody could reproduce.
 */
export const DESCRIPTORS: Readonly<
  Partial<Record<GifProviderId, GifProviderDescriptor>>
> = {
  giphy: GIPHY,
  klipy: KLIPY,
}

export const ALL_DESCRIPTORS: readonly GifProviderDescriptor[] =
  Object.values(DESCRIPTORS)

/**
 * Who answered, from what the response said.
 *
 * The board itself is the only honest source for this. Deriving it from the
 * environment instead looks equivalent and is not: the `?gifs=` lever pins a
 * provider per page load, so a Klipy board would carry Giphy's mark — which is
 * a false attribution, the precise failure the descriptor was introduced to
 * make impossible.
 *
 * `undefined` for `sample`, which is the offline shelf and belongs to nobody.
 */
export function descriptorFor(
  source: BoardSource,
): GifProviderDescriptor | undefined {
  return source === 'sample' ? undefined : DESCRIPTORS[source]
}
