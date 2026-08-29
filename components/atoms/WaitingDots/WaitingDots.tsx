import styles from './WaitingDots.module.scss'

export interface WaitingDotsProps {
  /**
   * What the wait is, for anyone who cannot see the dots. Omit it when the
   * heading underneath already says — the guest lobby's does, and two
   * announcements of the same fact is one too many.
   */
  label?: string
}

/**
 * Three dots, breathing. The room is doing something you are not waiting on a
 * number for.
 *
 * Not `ProgressRing`, which spins *around* something and marks one task in
 * flight, and not `RoundProgress`, whose pips are a count of rounds and mean
 * something specific. This one measures nothing — it is the design's way of
 * saying "still going" above a headline that says what.
 *
 * **The stagger is the design's static ramp, animated.** The artboard draws
 * the three at full, 55% and 25% opacity, which is a snapshot of exactly this
 * wave. Anyone who asked for stillness gets the snapshot back instead.
 */
export function WaitingDots({ label }: WaitingDotsProps) {
  return (
    <span
      className={styles.dots}
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
    >
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
      {label && <span className={styles.label}>{label}</span>}
    </span>
  )
}
