import { ALL_DESCRIPTORS } from './descriptors'
import type { BoardSource } from './provider'

/**
 * Where this app's images are allowed to come from.
 *
 * The event lane carries sender-supplied image URLs — a chat attachment, the
 * thumbnail on a quoted caption, and (once the picker has GIF tiles) a
 * reaction's own glyph. Every one of them lands in an `<img src>` in *every*
 * member's browser, so an unchecked URL is not a rendering bug: it is one
 * player making twenty other browsers fetch a host of their choosing. That is
 * a beacon, and it needs no script to work.
 *
 * `from` is stamped by the transport, which settles *who* said something. This
 * settles *what a message may point at*, which is a separate question and the
 * one the event lane never asked.
 *
 * It lives in `lib/gifs/` rather than `lib/room/` because it is a fact about
 * where this app's art comes from, not about how a room talks.
 */

/**
 * The app's own art: the offline sample GIFs, the reaction tiles, and the
 * imported emoji catalog one directory down.
 *
 * One optional path segment, not a general `.*` — `/media/emoji/1f600.svg`
 * passes and `/media/anything/else/x.svg` does not, so the surface this opens
 * is exactly the one directory the importer writes. Still `.svg` only: the
 * catalog's stills are SVG by design, and widening the extension would admit
 * formats nothing here serves.
 */
const SAME_ORIGIN = /^\/media\/(?:emoji\/)?[a-z0-9-]+\.svg$/

/**
 * Every provider's CDN, unioned — not just the one this build talks to.
 *
 * That is the load-bearing word. A `MediaRef` is persisted game state, so a
 * room resumed across a provider change, or a tab still running an older
 * bundle, can carry the previous provider's URL into this one. Gating this on
 * the *selected* provider would turn that into a broken image nobody could
 * reproduce, on a screen the whole round is about.
 *
 * Read from the descriptors so there is one list. `descriptors.ts` is data
 * only, with no HTTP client behind it, because this function runs on the event
 * lane for every inbound message.
 *
 * Parsed with `URL` rather than matched as a string, so
 * `https://giphy.com.example.invalid/x.gif` fails on hostname rather than
 * passing on a prefix — and `exact` hosts do not even accept a subdomain,
 * because `endsWith('klipy.com')` would have admitted `evilklipy.com`.
 */
function providerForHost(hostname: string): BoardSource | undefined {
  for (const descriptor of ALL_DESCRIPTORS) {
    for (const { host, exact } of descriptor.mediaHosts) {
      if (hostname === host) return descriptor.id
      if (!exact && hostname.endsWith(`.${host}`)) return descriptor.id
    }
  }
  return undefined
}

/**
 * Whether an image URL may be rendered from something a player sent.
 *
 * Rejects `data:` (an unbounded payload on a lane sized for a sentence, and
 * against the model's no-data-URI invariant), `blob:` (resolves only in the
 * tab that minted it, so it is a broken image everywhere else), `javascript:`,
 * plain `http:`, and every third-party origin.
 */
export function isAllowedImageSrc(src: string): boolean {
  if (typeof src !== 'string' || src.length === 0 || src.length > 2048) return false
  if (src.startsWith('/')) return SAME_ORIGIN.test(src)

  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  return url.protocol === 'https:' && providerForHost(url.hostname) !== undefined
}

/**
 * Which provider served an image, judged from its URL alone.
 *
 * `MediaRef` records `{ src, alt, width?, height? }` and deliberately not a
 * provider — that field existed once and was removed. Attribution on a shared
 * card still has to name somebody, so it is derived here rather than restored
 * there: no state change, no protocol change, no migration, and it stays
 * correct for GIFs picked before a provider swap, which a stored flag would
 * not.
 *
 * `undefined` for the app's own art, which belongs to nobody and is credited
 * to nobody.
 */
export function providerOf(src: string): BoardSource | undefined {
  if (!isAllowedImageSrc(src)) return undefined
  if (src.startsWith('/')) return undefined
  try {
    return providerForHost(new URL(src).hostname)
  } catch {
    return undefined
  }
}
