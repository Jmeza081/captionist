/**
 * The room's one keyboard shortcut.
 *
 * ## Why not ⌘P
 *
 * It was the first choice and it cannot work. Safari does not dispatch keydown
 * for combinations reserved by browser UI at all, so the listener never runs;
 * elsewhere `preventDefault` on print is best-effort. The failure mode is an OS
 * print sheet opening over a game that is being screen-shared to a room, which
 * is the worst possible place for it.
 *
 * ⌥/Alt + P is claimed by no browser, and it keeps two keys to draw — which is
 * the point of the hint. Bare `P` was the other candidate and is what presenter
 * tools use; it was passed over only because a single cap says less.
 *
 * ## Why `code` and not `key`
 *
 * On macOS ⌥P emits `π`, so `event.key` is not "p" and never will be.
 * `event.code` is the physical key and is what a shortcut means.
 */
export const PAUSE_CODE = 'KeyP'

/**
 * Whether this event is the pause shortcut.
 *
 * `altKey` on both platforms — ⌥ on a Mac and Alt on a PC are the same
 * modifier to the browser, so there is nothing to branch on here. The glyph is
 * the only thing that differs, and that is `altGlyph` below.
 *
 * Refuses the event when another modifier is down, so ⌃⌥P and ⌘⌥P — which a
 * person may well be reaching for on the way to something else — are not this.
 */
export function isPauseShortcut(event: KeyboardEvent): boolean {
  if (event.code !== PAUSE_CODE) return false
  if (!event.altKey) return false
  if (event.ctrlKey || event.metaKey || event.shiftKey) return false
  return !event.repeat
}

/**
 * Whether a keystroke belongs to whatever the person is typing into.
 *
 * The room is full of text fields — the caption composer, the prompt, chat —
 * and a shortcut that fires while one of them has focus would pause the round
 * every time somebody typed the letter in a caption. `isContentEditable`
 * covers the chat composer if it ever stops being a `textarea`.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

/**
 * What to print on the modifier key.
 *
 * **Not `navigator.userAgentData.platform`.** It is the modern answer and it
 * is wrong here: under Playwright it reports `Windows` on macOS
 * (playwright#39568), so the E2E suite would assert a glyph no Mac user sees.
 * `navigator.platform` is deprecated and still correct, which is the trade
 * worth making for a decoration.
 *
 * "Alt" is the answer when we cannot tell, because it is the name of the key on
 * every keyboard that is not an Apple one — the wrong guess is a PC user seeing
 * ⌥, not a Mac user seeing a word.
 */
export function altGlyph(platform: string | undefined): string {
  if (platform === undefined) return 'Alt'
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌥' : 'Alt'
}
