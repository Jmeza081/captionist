/**
 * The GIF behind the waiting faces.
 *
 * Named rather than searched, for the reason `notFound.ts` gives about the
 * 404: nobody is picking for this, and a screen that exists to say *wait*
 * should not be at the mercy of what happens to be trending. What is committed
 * is the slug; the media is resolved in the browser on every load, because a
 * committed URL is retained delivery data — see ADR-0025.
 *
 * **Why this one.** The waiting faces are the barest screens in the app — an
 * avatar, a headline, a line of body, and a lot of canvas — and the thing that
 * makes a backdrop work there is that it has to lose to the text. This clip
 * opens almost entirely black with one warm ember low in the frame, then
 * brightens into a lit close-up, so it is drawn under the landing hero's own
 * `full` scrim: at `soft` the bright half of the clip competed with the
 * headline it sits behind. What survives the veil is the warmth, which is all
 * a backdrop on a waiting screen is for.
 *
 * **The renditions are chosen, not guessed.** The MP4 is a fraction of the
 * GIF's bytes and decodes on the video path rather than the main thread —
 * [ADR 0005](../../docs/adr/0005-media-that-can-move-ships-a-still.md) is why
 * there is a still beside it at all, and why the still is what a visitor who
 * asked for stillness gets. The adapter picks both off the same rendition, so
 * the poster and the video do not jump.
 *
 * Check the clip actually *renders* before swapping this slug, not just that
 * the lookup answers — a provider that has pulled a GIF may still return a
 * placeholder card, which would be a strange thing to wait in front of.
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
  /**
   * For the credit line — this is somebody's work, not our chrome.
   *
   * The provider's own title for it. Klipy publishes no uploader, so there is
   * nobody more specific to name than the work and the provider.
   */
  credit: string
}

/**
 * The backdrop, resolved in the browser from `BACKDROP_SLUG`.
 *
 * There is no committed URL any more: the request has to come from a client and
 * the media URL must not be retained. `useWaitingBackdrop` does the resolving
 * and returns `undefined` until it lands — and forever, if there is no key.
 *
 * An absent backdrop is an absent decoration. That was already true when the
 * Playwright suite resolved every host but the dev server to nothing, which is
 * why the specs check the element and its source rather than a pixel.
 */
export function toBackdrop(gif: {
  mp4?: string
  still?: string
  src: string
  alt: string
}): Backdrop | undefined {
  // Without the video there is no backdrop — a still image behind the headline
  // is a different design, not a degraded one.
  if (!gif.mp4) return undefined
  return { mp4: gif.mp4, still: gif.still ?? gif.src, credit: gif.alt }
}
