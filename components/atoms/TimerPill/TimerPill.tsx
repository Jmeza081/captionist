import styles from './TimerPill.module.scss'

export interface TimerPillProps {
  /** Whole seconds remaining. */
  seconds: number
  /** What the clock is counting down to — "left", "to pick". */
  suffix?: string
  /**
   * Force the urgent look regardless of the clock. Sudden death is always
   * urgent even when the number is high.
   */
  urgent?: boolean
}

/** At or below this, the pill turns red. From DESIGNSYSTEM.md §4.6. */
const URGENT_AT = 15

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * The round clock, top-right of every in-round header.
 *
 * Colour is never the only signal — the number counts down alongside it — so
 * the red state stays legible to anyone who can't see the tint.
 */
export function TimerPill({
  seconds,
  suffix = 'left',
  urgent = false,
}: TimerPillProps) {
  const isUrgent = urgent || seconds <= URGENT_AT
  const clock = formatClock(seconds)

  return (
    <span
      className={`${styles.pill} ${isUrgent ? styles.urgent : styles.neutral}`}
      role="timer"
      aria-live={isUrgent ? 'assertive' : 'off'}
    >
      {clock} {suffix}
    </span>
  )
}
