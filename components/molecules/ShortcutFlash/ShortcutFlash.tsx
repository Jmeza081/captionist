'use client'

import { useEffect, useState } from 'react'
import { Keycap } from '@/components/atoms/Keycap'
import { useAltGlyph } from '@/lib/useKeyboard'
import styles from './ShortcutFlash.module.scss'

/** How long the keys stay up. VS Code's screencast mode settled on the same. */
export const FLASH_MS = 800

export interface ShortcutFlashProps {
  /** Whether the clock is currently held. The flash fires when this changes. */
  paused: boolean
  /**
   * Whether this viewer is the one who can pause.
   *
   * A guest's room never draws it: they cannot press the key, and a picture of
   * a shortcut they do not have is a lie about their own keyboard.
   */
  enabled: boolean
}

/**
 * The keys, and what they just did, in the middle of the screen.
 *
 * **Fired by the transition, not by the keystroke.** The two are almost the
 * same instant and not quite: a press sends `host/togglePaused` and the state
 * arrives a beat later, so a flash triggered by the press would have to guess
 * which way it went — and guess wrong for a frame, in a word the size of a
 * headline. Watching the state instead makes the label correct by
 * construction, and means the flash reports what the room did rather than what
 * somebody asked it to do.
 *
 * A consequence worth knowing: the toolbox button fires it too, since that is
 * also a real transition. That reads as teaching the shortcut rather than as
 * noise, and it is one condition here if it ever stops being wanted.
 *
 * **Decorative, and `aria-hidden`.** `TimerPill` carries the same fact in the
 * accessibility tree, and it is the one that persists — this is a picture for
 * a room watching a projector.
 */
export function ShortcutFlash({ paused, enabled }: ShortcutFlashProps) {
  /*
    Adjusting state during render, which is React's own escape hatch for
    "something changed in props and this component derives from it" — not an
    effect. An effect would paint the old value first and set state after,
    which is both the flicker this exists to avoid and the cascading-render
    pattern React 19 refuses.

    `burst` counts transitions so a second press restarts the animation rather
    than joining one already half over.
  */
  const [seen, setSeen] = useState(paused)
  const [burst, setBurst] = useState(0)
  const [spent, setSpent] = useState(0)

  if (seen !== paused) {
    setSeen(paused)
    setBurst((n) => n + 1)
  }

  const glyph = useAltGlyph()
  const shown = enabled && burst > 0 && burst !== spent

  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setSpent(burst), FLASH_MS)
    return () => clearTimeout(timer)
    // Unmounted on a timer rather than on `animationend`: reduced motion
    // replaces the animation, the event never fires, and the keys would sit
    // there for the rest of the round.
  }, [burst, shown])

  if (!shown) return null

  return (
    <div className={styles.dock} aria-hidden="true">
      {/* Keyed on the burst so the animation restarts from the top. */}
      <div key={burst} className={styles.flash}>
        <div className={styles.keys}>
          <Keycap size="lg">{glyph}</Keycap>
          <Keycap size="lg">P</Keycap>
        </div>
        {/* Past tense: it has already happened by the time this is drawn. */}
        <span className={styles.label}>{paused ? 'Paused' : 'Resumed'}</span>
      </div>
    </div>
  )
}
