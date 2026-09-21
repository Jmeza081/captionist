'use client'

import { useSyncExternalStore } from 'react'
import { altGlyph } from './shortcuts'

/**
 * Whether this device is one a shortcut hint makes sense on.
 *
 * A pointer question, not a width one. The host is often on a laptop
 * screen-shared to a room, but they can equally be on a phone in landscape —
 * which is wide, and has no keys. A breakpoint gets that backwards and offers
 * a keystroke to somebody holding a slab of glass.
 *
 * `hover: hover` as well as `pointer: fine`, because a stylus is fine-pointed
 * and still comes with no keyboard.
 */
const QUERY = '(hover: hover) and (pointer: fine)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

/**
 * No keyboard is the safe guess, the same instinct as `useReducedMotion`'s
 * stillness: of the two wrong answers, "the hint appeared a moment late" is
 * kinder than a phone being told to press a key it does not have.
 */
const getServerSnapshot = () => false

export function useHasKeyboard(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * The modifier's glyph — `⌥` on a Mac, `Alt` everywhere else.
 *
 * Through `useSyncExternalStore` rather than read during render: `navigator`
 * does not exist on the server, and reading it in an effect is the hydration
 * mismatch this pattern exists to avoid. The store never changes — nobody
 * swaps platform mid-room — so `subscribe` is a no-op and the value is read
 * once per client.
 */
const noopSubscribe = () => () => {}
const readGlyph = () => altGlyph(navigator.platform)
const serverGlyph = () => 'Alt'

export function useAltGlyph(): string {
  return useSyncExternalStore(noopSubscribe, readGlyph, serverGlyph)
}
