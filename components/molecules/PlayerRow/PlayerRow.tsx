import { Avatar, type AvatarProps } from '@/components/atoms/Avatar'
import { Tag } from '@/components/atoms/Tag'
import styles from './PlayerRow.module.scss'

/** What the row is being used for. The design draws one row, four ways. */
export type PlayerRowVariant = 'roster' | 'tracker' | 'standing'

export interface PlayerRowProps {
  player: Pick<AvatarProps, 'name' | 'color' | 'src'>
  variant?: PlayerRowVariant
  /** Shows the HOST tag. */
  host?: boolean
  /** Right-hand status for the tracker — "submitted", "typing…". */
  status?: string
  /** `true` renders the status green, `false` greys the whole row back. */
  done?: boolean
  /** Standings only: placement, score, and the bar's share of the leader. */
  rank?: number
  score?: number
  /** 0–1, the row's score as a fraction of the leader's. */
  share?: number
}

/**
 * One player, in a list. Lobby roster, submission tracker, or standings.
 *
 * This is one component with a `variant` rather than three near-identical
 * rows — the avatar, name and right-hand slot are the same in all of them.
 */
export function PlayerRow({
  player,
  variant = 'roster',
  host = false,
  status,
  done = false,
  rank,
  score,
  share = 0,
}: PlayerRowProps) {
  const pending = status !== undefined && !done
  const isWinner = rank === 1

  const classes = [
    styles.row,
    styles[variant],
    pending ? styles.pending : '',
    isWinner ? styles.winner : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      {rank !== undefined && <span className={styles.rank}>{rank}</span>}

      <Avatar
        {...player}
        size={variant === 'roster' || variant === 'standing' ? 40 : 34}
        dimmed={pending}
      />

      <span className={styles.name}>{player.name}</span>

      {host && <Tag>Host</Tag>}

      {status && (
        <span className={`${styles.status} ${done ? styles.done : ''}`}>
          {status}
        </span>
      )}

      {variant === 'standing' && (
        <>
          <span className={styles.bar} aria-hidden="true">
            <span
              className={styles.barFill}
              style={{ width: `${Math.min(100, Math.max(0, share * 100))}%` }}
            />
          </span>
          <span className={styles.score}>{score}</span>
        </>
      )}
    </div>
  )
}
