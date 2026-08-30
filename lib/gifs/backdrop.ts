/**
 * The GIF behind the waiting faces.
 *
 * Hard-coded rather than searched, for the reason `notFound.ts` gives about
 * the 404: nobody is picking for this, and a screen that exists to say *wait*
 * should not depend on an upstream API answering. It is a URL on Giphy's CDN,
 * so it costs no key and no request of ours.
 *
 * **Why this one.** The waiting faces are the barest screens in the app — an
 * avatar, a headline, a line of body, and a lot of canvas — and the thing that
 * makes a backdrop work there is that it has to lose to the text. This clip is
 * almost entirely black with one warm ember low in the frame: at 480×270 the
 * mean luminance is low enough that the headline reads over it under
 * `$scrim-wall-soft` rather than needing the full weight the landing hero
 * takes. A brighter GIF would have needed a scrim heavy enough to make having
 * one pointless.
 *
 * **The renditions are chosen, not guessed.** `giphy.mp4` is 360KB against
 * `giphy.gif`'s 2.4MB, and decodes on the video path rather than the main
 * thread — [ADR 0005](../../docs/adr/0005-media-that-can-move-ships-a-still.md)
 * is why there is a still beside it at all, and why the still is what a
 * visitor who asked for stillness gets. `480w_s.jpg` is the still: 32KB, and
 * the same 16:9 frame, so the poster and the video do not jump.
 *
 * Check a rendition actually *renders* before swapping this, not just that it
 * answers 200 — Giphy serves a "THIS CONTENT IS NOT AVAILABLE" card at some
 * rendition paths, which would be a strange thing to wait in front of.
 *
 * **No stub swap, unlike `notFoundGif()`.** The Playwright suite resolves every
 * host but the dev server to nothing, so this simply does not load there — and
 * an absent decoration is an absent decoration, where the 404's absent card
 * would have been a broken assertion. The specs check the element and its
 * source instead of a pixel.
 */
export interface Backdrop {
  /** The clip, as MP4. Muted, looped, and paused until motion is allowed. */
  mp4: string
  /** The frame a still visitor sees, and the poster behind the video. */
  still: string
  /** For the credit line — this is somebody's work, not our chrome. */
  credit: string
  creditHref: string
}

export const WAITING_BACKDROP: Backdrop = {
  mp4: 'https://media.giphy.com/media/VIPfTy8y1Lc5iREYDS/giphy.mp4',
  still: 'https://media.giphy.com/media/VIPfTy8y1Lc5iREYDS/480w_s.jpg',
  credit: 'Young Thug',
  creditHref: 'https://giphy.com/gifs/youngthug-VIPfTy8y1Lc5iREYDS',
}
