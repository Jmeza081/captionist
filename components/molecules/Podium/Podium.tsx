import { Avatar } from '@/components/atoms/Avatar'
import styles from './Podium.module.scss'
import type { PlayerFace } from '@/lib/game/types'

export interface PodiumPlace {
  player: PlayerFace
  score: number
}

export interface PodiumProps {
  /** First, second and third. Third is optional in a very small room. */
  first: PodiumPlace
  second: PodiumPlace
  third?: PodiumPlace
}

/**
 * The final three, after round five.
 *
 * Ordered second-first-third visually so the winner stands in the middle, but
 * the DOM order is 1-2-3 — a screen reader should hear the standings, not the
 * stagecraft.
 */
export function Podium({ first, second, third }: PodiumProps) {
  return (
    <ol className={styles.podium}>
      <li className={`${styles.place} ${styles.first}`}>
        <Avatar {...first.player} size={56} selected />
        <div className={styles.block}>
          <span className={styles.rank}>1</span>
          <span className={styles.name}>{first.player.name}</span>
          <span className={styles.score}>{first.score} pts</span>
        </div>
      </li>

      <li className={`${styles.place} ${styles.second}`}>
        <Avatar {...second.player} size={40} />
        <div className={styles.block}>
          <span className={styles.rank}>2</span>
          <span className={styles.name}>{second.player.name}</span>
          <span className={styles.score}>{second.score} pts</span>
        </div>
      </li>

      {third && (
        <li className={`${styles.place} ${styles.third}`}>
          <Avatar {...third.player} size={40} />
          <div className={styles.block}>
            <span className={styles.rank}>3</span>
            <span className={styles.name}>{third.player.name}</span>
            <span className={styles.score}>{third.score} pts</span>
          </div>
        </li>
      )}
    </ol>
  )
}
