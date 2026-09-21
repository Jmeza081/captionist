'use client'

import { Keycap } from '@/components/atoms/Keycap'
import { useAltGlyph, useHasKeyboard } from '@/lib/useKeyboard'
import styles from './ShortcutHint.module.scss'

export interface ShortcutHintProps {
  /** What the shortcut does, verb first — "pause", "resume". */
  action: string
}

/**
 * "Press ⌥ P to pause", beside the clock it pauses.
 *
 * Renders nothing without a keyboard to press. That is a pointer query rather
 * than a breakpoint — a host in landscape on a phone has a wide screen and no
 * keys — so the test is `useHasKeyboard`, and on the server it answers no.
 *
 * **The caps are `aria-hidden` and the sentence is written out.** Two keycaps
 * read aloud are "⌥, P", which teaches nobody anything; the visually hidden
 * copy says "Press Alt plus P to pause" as a sentence. The glyph and the word
 * differ on purpose — ⌥ is a picture and "Alt" is its name.
 */
export function ShortcutHint({ action }: ShortcutHintProps) {
  const hasKeyboard = useHasKeyboard()
  const glyph = useAltGlyph()

  if (!hasKeyboard) return null

  return (
    <span className={styles.hint}>
      <span className={styles.srOnly}>{`Press Alt plus P to ${action}`}</span>
      <span aria-hidden="true" className={styles.shown}>
        Press
        <span className={styles.caps}>
          <Keycap>{glyph}</Keycap>
          <Keycap>P</Keycap>
        </span>
        to {action}
      </span>
    </span>
  )
}
