import styles from './TimerPill.module.scss'

export interface TimerPillProps {
  /** Whole seconds remaining. */
  seconds: number
  /**
   * What the clock is counting down to — "left", "to pick". Pass an empty
   * string on the waiting screens, where the design shows a bare `0:24`
   * because the deadline is somebody else's.
   */
  suffix?: string
  /**
   * The clock is held. Takes precedence over `urgent` — a paused clock at four
   * seconds is not running out, it is stopped, and drawing it red would be the
   * pill shouting about a deadline nobody is on.
   */
  paused?: boolean
  /**
   * Force the urgent look regardless of the clock. Sudden death is always
   * urgent even when the number is high.
   */
  urgent?: boolean
}

/**
 * At or below this, the pill turns red. From DESIGNSYSTEM.md §4.6.
 *
 * Exported because `ProgressRail` has no threshold of its own — the room shell
 * computes urgency once and drives both from the same number.
 */
export const URGENT_AT = 15

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
  paused = false,
}: TimerPillProps) {
  const isUrgent = !paused && (urgent || seconds <= URGENT_AT)
  const clock = formatClock(seconds)

  // What it was counting *to* stops being true the moment it stops counting,
  // so the suffix gives way rather than sitting beside a number that is not
  // moving. "0:24 to pick" on a held clock is a promise about a deadline that
  // is not running.
  const tone = paused ? styles.paused : isUrgent ? styles.urgent : styles.neutral
  const label = paused ? `${clock} · paused` : suffix ? `${clock} ${suffix}` : clock

  return (
    <span
      className={`${styles.pill} ${tone}`}
      role="timer"
      // Nothing to announce when nothing is counting down. Assertive on a
      // frozen number would interrupt a screen reader to say the same thing
      // forever.
      aria-live={isUrgent ? 'assertive' : 'off'}
    >
      {label}
    </span>
  )
}
