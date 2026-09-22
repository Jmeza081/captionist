'use client'

import { Keycap } from '@/components/atoms/Keycap'
import { useAltGlyph, useHasKeyboard } from '@/lib/useKeyboard'
import styles from './ShortcutHint.module.scss'

export interface ShortcutHintProps {
  /** What the shortcut does, verb first — "pause", "resume", "advance". */
  action: string
  /**
   * The glyph on the second keycap. "P" for the pause shortcut, "↵" for the
   * host's advance.
   */
  cap?: string
  /**
   * How that key is *said*, when the glyph is a picture rather than a letter.
   * "↵" read aloud is nothing, so the advance hint spells "Return".
   */
  capLabel?: string
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
export function ShortcutHint({ action, cap = 'P', capLabel }: ShortcutHintProps) {
  const hasKeyboard = useHasKeyboard()
  const glyph = useAltGlyph()
  const spoken = capLabel ?? cap

  if (!hasKeyboard) return null

  return (
    <span className={styles.hint}>
      <span className={styles.srOnly}>{`Press Alt plus ${spoken} to ${action}`}</span>
      <span aria-hidden="true" className={styles.shown}>
        Press
        <span className={styles.caps}>
          <Keycap>{glyph}</Keycap>
          <Keycap>{cap}</Keycap>
        </span>
        to {action}
      </span>
    </span>
  )
}
