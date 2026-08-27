import styles from './RoundProgress.module.scss'

export interface RoundProgressProps {
  /** Rounds finished so far. */
  played: number
  /** Rounds in the game. Five, unless the host changed it. */
  total: number
  /** Show the "2 of 5 rounds" caption beside the pips. */
  showLabel?: boolean
}

/**
 * How far through the game the room is, as a row of pips.
 *
 * The pips are decorative — the count is stated in text for anyone who can't
 * distinguish the filled ones.
 */
export function RoundProgress({
  played,
  total,
  showLabel = true,
}: RoundProgressProps) {
  const pips = Array.from({ length: total }, (_, i) => i < played)

  return (
    <div className={styles.wrap}>
      <div className={styles.pips} aria-hidden="true">
        {pips.map((filled, i) => (
          <span
            key={i}
            className={`${styles.pip} ${filled ? styles.played : ''}`}
          />
        ))}
      </div>
      <span className={showLabel ? styles.label : styles.srOnly}>
        {played} of {total} rounds
      </span>
    </div>
  )
}
