import { giphyProvider } from './giphy'
import { klipyProvider } from './klipy'
import type { GifProvider, GifProviderId } from './provider'

/**
 * Which provider this build talks to, and with what key.
 *
 * **The reads below are written out in full, and they have to stay that way.**
 * Next inlines `NEXT_PUBLIC_*` by literal name at build time, so
 * `process.env[id]` comes back `undefined` in the browser however correct it
 * looks in Node — and it looks correct in every test, because vitest runs in
 * Node where the dynamic read works. That is the failure mode this comment
 * exists to prevent: a lookup that passes unit tests and returns nothing in
 * production.
 *
 * So the record is the whole trick — the *reads* are static and the *lookup*
 * is not. Adding a provider means adding a literal line here. There is no way
 * to make that generic, and `registry.test.ts` asserts nobody tried.
 *
 * Built per call rather than once at module scope. Inlining does not care —
 * Next substitutes the literal wherever it appears — but a frozen module-scope
 * constant would make the env unmockable, and every test that sets a key after
 * importing this would silently assert against whatever the environment held at
 * import time.
 */
function keys(): Readonly<Partial<Record<GifProviderId, string | undefined>>> {
  return {
    giphy: process.env.NEXT_PUBLIC_GIPHY_API_KEY,
    klipy: process.env.NEXT_PUBLIC_KLIPY_API_KEY,
  }
}

/**
 * The adapters that actually exist.
 *
 * A provider is selectable only if it appears here *and* has a key. Klipy joins
 * once its adapter lands; until then naming it selects nothing, which is the
 * correct answer rather than a silent fallback to somebody else's content.
 */
const PROVIDERS: Readonly<Partial<Record<GifProviderId, GifProvider>>> = {
  giphy: giphyProvider,
  klipy: klipyProvider,
}

/**
 * Preference order when nothing has been asked for by name.
 *
 * **Klipy first.** Their production key is free and unmetered, which is the
 * whole reason the seam exists — and until one is issued, their test key is 100
 * calls an hour, exactly the allowance the Giphy beta key it replaces gives. So
 * this costs nothing to try and is one line to undo.
 *
 * It also puts the usage ledger on the right provider. A production-key
 * application wants this app's Klipy traffic; while Giphy answered the boards,
 * `usage.ts` was diligently measuring the wrong thing. See ADR-0022.
 */
const PREFERENCE: readonly GifProviderId[] = ['klipy', 'giphy']

/** A deployment-level override, read as a literal for the same reason as the keys. */
function configured(): string | undefined {
  return process.env.NEXT_PUBLIC_GIF_PROVIDER
}

function usable(id: GifProviderId | undefined): GifProvider | undefined {
  if (!id) return undefined
  const provider = PROVIDERS[id]
  return provider && keys()[id] ? provider : undefined
}

function known(value: string | undefined): GifProviderId | undefined {
  return value === 'giphy' || value === 'klipy' ? value : undefined
}

export function keyFor(id: GifProviderId): string | undefined {
  return keys()[id]
}

/**
 * The provider a board should come from, resolved at call time.
 *
 * Call time, not module scope: `pinned` comes from the URL, and there is no
 * `window` when this module is first evaluated on the server.
 *
 * A named provider that has no key falls through rather than erroring, so a
 * fresh clone holding only one of the two keys still gets a live board instead
 * of a configuration lecture.
 */
export function selectProvider(pinned?: GifProviderId): GifProvider | undefined {
  return (
    usable(pinned) ??
    usable(known(configured())) ??
    PREFERENCE.map(usable).find(Boolean)
  )
}

/**
 * Who *would* be selected if a key existed.
 *
 * The offline shelf has to say whose key is missing, and by then
 * `selectProvider` has already returned nothing — so this answers the question
 * the message needs rather than the one the fetch needs.
 */
export function intendedProvider(pinned?: GifProviderId): GifProvider {
  const id = pinned ?? known(configured()) ?? PREFERENCE[0]
  const provider = id && PROVIDERS[id]
  // `PREFERENCE` is a non-empty literal of providers that exist, so the
  // fallback only satisfies the compiler.
  return provider ?? giphyProvider
}
