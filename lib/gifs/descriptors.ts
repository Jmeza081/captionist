import type { GifProviderDescriptor, GifProviderId } from './provider'

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
  // Klipy lands here once a real response has confirmed its media hosts and its
  // mandated wording. `Partial` rather than a placeholder entry: a descriptor
  // built from guesses would let the registry select a provider that cannot
  // work, and it would do it silently. Absent is the honest state.
}

export const ALL_DESCRIPTORS: readonly GifProviderDescriptor[] =
  Object.values(DESCRIPTORS)
