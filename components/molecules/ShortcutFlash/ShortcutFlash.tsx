'use client'

import { useEffect, useState } from 'react'
import { Keycap } from '@/components/atoms/Keycap'
import { useAltGlyph } from '@/lib/useKeyboard'
import styles from './ShortcutFlash.module.scss'

/** How long the keycaps stay up. VS Code's screencast mode settled on the same. */
export const FLASH_MS = 800

export interface ShortcutFlashProps {
  /**
   * Bumped once per press. A counter rather than a boolean, because two
   * presses in a row are two flashes and a boolean that is already `true`
   * cannot say so.
   */
  burst: number
}

/**
 * The keys, shown on screen for as long as it takes to read them.
 *
 * Under the clock rather than centred: the thing that flashes should be beside
 * the thing that changed, so a room watching a shared screen reads the cause
 * and the effect in one glance.
 *
 * **Decorative, and `aria-hidden`.** `TimerPill` is what announces the state;
 * this is a picture of a keystroke for people watching a projector. A second
 * announcement would say the same thing twice to the one person who cannot see
 * either of them.
 *
 * Unmounted on a timer rather than on `animationend`, which is the house
 * pattern and exists for a real reason: reduced motion replaces the animation,
 * the event never fires, and a listener would leave the keys on screen for the
 * rest of the round.
 */
export function ShortcutFlash({ burst }: ShortcutFlashProps) {
  /*
    Which burst has already had its moment.

    Derived rather than a `shown` boolean set on arrival: setting state
    synchronously inside an effect is the cascading-render pattern React 19
    rightly refuses. So a burst is visible from the instant the prop changes —
    no effect needed to show it — and the only state write is the one inside
    the timeout, which is asynchronous and therefore fine.
  */
  const [spent, setSpent] = useState(0)
  const glyph = useAltGlyph()
  const shown = burst > 0 && burst !== spent

  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setSpent(burst), FLASH_MS)
    return () => clearTimeout(timer)
  }, [burst, shown])

  if (!shown) return null

  return (
    // Keyed on the burst so a second press restarts the animation rather than
    // joining one already halfway through.
    <div key={burst} className={styles.flash} aria-hidden="true">
      <Keycap size="lg">{glyph}</Keycap>
      <Keycap size="lg">P</Keycap>
    </div>
  )
}
