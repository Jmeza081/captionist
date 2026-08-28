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

/** The app's own art: the offline sample GIFs and the reaction tiles. */
const SAME_ORIGIN = /^\/media\/[a-z0-9-]+\.svg$/

/**
 * Giphy's CDN.
 *
 * Parsed with `URL` rather than matched as a string, so
 * `https://giphy.com.example.invalid/x.gif` fails on hostname rather than
 * passing on a prefix.
 */
function isGiphyHost(hostname: string): boolean {
  return hostname === 'giphy.com' || hostname.endsWith('.giphy.com')
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
  return url.protocol === 'https:' && isGiphyHost(url.hostname)
}
