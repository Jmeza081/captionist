import type { ReactNode } from 'react'
import { Icon } from '@/components/atoms/Icon'
import styles from './StatusPill.module.scss'

export type StatusContext = 'media' | 'surface'

export interface StatusPillProps {
  children: ReactNode
  /**
   * `media` sits over an image and carries its own scrim and blur, because it
   * has to stay legible on top of an arbitrary GIF. `surface` sits on the
   * canvas. Same split, and the same reasoning, as `TallyPill`.
   */
  context?: StatusContext
  /** The green check the design puts on a confirmation. */
  confirmed?: boolean
  /**
   * A pulsing dot instead of a check, for a state the room is still in rather
   * than one it has reached. The design's guest lobby draws it amber, which is
   * the same "not yet" the timer uses.
   */
  waiting?: boolean
  /** A quieter second clause, after a hairline divider. */
  note?: string
}

/**
 * A short statement of where the room is — "Locked in", "4 of 7 have voted".
 *
 * Not `TallyPill` (which counts one reaction) and not `PresencePill` (which
 * counts who is here): this one carries a sentence. It exists rather than
 * living in two screens' stylesheets because the waiting screen needs it over
 * media and the tiebreak needs it on the canvas, and the scrim treatment is
 * the part that would drift.
 */
export function StatusPill({
  children,
  context = 'surface',
  confirmed = false,
  waiting = false,
  note,
}: StatusPillProps) {
  return (
    <span className={`${styles.pill} ${styles[context]}`}>
      {confirmed && <Icon name="check" size={13} color="var(--status-pill-check)" />}
      {!confirmed && waiting && <span className={styles.dot} aria-hidden="true" />}
      <span className={styles.label}>{children}</span>
      {note && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.note}>{note}</span>
        </>
      )}
    </span>
  )
}
