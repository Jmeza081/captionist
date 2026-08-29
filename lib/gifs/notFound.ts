import { SAMPLE_GIFS } from './samples'
import type { GifResult } from './types'

/**
 * The GIF on the 404 page.
 *
 * One hard-coded pick rather than a search, for the same reason the page's
 * copy is hard-coded: a 404 is not a round, there is nobody to pick for it,
 * and a page that exists to say "this went wrong" should not depend on an
 * upstream API answering. It is a URL on Giphy's CDN, so it costs no API key
 * and no request of ours — `isAllowedImageSrc` would pass it too, though
 * nothing checks it here: this string is ours, not a player's.
 *
 * Confused Travolta, because the joke tells itself: he has been the
 * internet's shorthand for "there is nothing here" for a decade, which is the
 * whole content of an HTTP 404. This is GIPHY's own cut of him, and he is
 * looking around an **empty open-plan office** rather than the usual beach —
 * which is the room this game is played in.
 *
 * It is also 320×320, and that is why it is this one. A media card is square
 * now (`$media-ratio`), and the beach cut is 500×251: `object-fit: cover`
 * would have thrown away half its width and doubled what was left.
 *
 * WebP rather than the GIF — 1.08MB against 2.5MB — on a page nobody meant to
 * land on. Check a rendition actually *renders* before swapping this, not just
 * that it answers 200: Giphy serves a "THIS CONTENT IS NOT AVAILABLE" card at
 * some rendition paths, which is a funnier 404 than the one we wrote and not
 * the one we chose.
 */
const TRAVOLTA: GifResult = {
  id: 'giphy-26tPcU5DDLaXPrPGg',
  src: 'https://media.giphy.com/media/26tPcU5DDLaXPrPGg/giphy.webp',
  still: 'https://media.giphy.com/media/26tPcU5DDLaXPrPGg/480w_s.jpg',
  alt: 'John Travolta looking around an empty office for something that is not there',
  keywords: ['404', 'confused', 'lost', 'travolta'],
}

/**
 * The offline stand-in, matched by subject rather than by index.
 *
 * `GIFS_STUB=1` is how the Playwright suite and a keyless checkout keep every
 * surface off a third party — and here it is load-bearing twice over, because
 * `playwright.config.ts` also resolves every host but the dev server to
 * nothing. Without this the 404 spec would assert a broken image.
 */
const OFFLINE = SAMPLE_GIFS.find((gif) => gif.id === 'sample-prod')

/**
 * Which GIF the 404 page shows.
 *
 * A function rather than a constant, so the stub switch is read when the page
 * renders rather than when the module is first evaluated — the way
 * `wallTiles()` reads it.
 *
 * Be honest about how far that goes: `/_not-found` is prerendered (`○` in
 * `next build`), so a production build resolves this once and bakes the answer
 * in either way. Where it earns its keep is `next dev`, which renders per
 * request — and that is where the Playwright suite runs, with `GIFS_STUB=1`
 * set by `playwright.config.ts`.
 */
export function notFoundGif(): GifResult {
  if (process.env.GIFS_STUB === '1') return OFFLINE ?? TRAVOLTA
  return TRAVOLTA
}
