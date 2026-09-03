import { Avatar } from '@/components/atoms/Avatar'
import { Tag } from '@/components/atoms/Tag'
import styles from './PlayerRow.module.scss'
import type { PlayerFace } from '@/lib/game/types'

/**
 * What the row is being used for. The design draws one row, four ways.
 *
 * `pill` is the guest lobby's: the same avatar, name and tag, laid out to wrap
 * inline rather than fill a column. A guest is answering "who else is here",
 * which is a list of names — the host is answering "who am I still waiting
 * on", which is a list of rows.
 */
export type PlayerRowVariant = 'roster' | 'tracker' | 'standing' | 'pill'

export interface PlayerRowProps {
  player: PlayerFace
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
  /**
   * Standings only: the quiet right-hand column — "2 rounds won", or
   * "+4 this round" before anyone has won one. Hidden on a phone, where the
   * score is the only number with room.
   */
  note?: string
  /** Marks this row as the viewer's own. */
  you?: boolean
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
  note,
  you = false,
}: PlayerRowProps) {
  const pending = status !== undefined && !done
  const isWinner = rank === 1

  const classes = [
    styles.row,
    styles[variant],
    you ? styles.you : '',
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
        // `pill` was the design's 30 and is 34 now, which collapsed it into the
        // tracker's size: 30 is under `HAT_MIN_SIZE`, and the guest lobby is
        // the one screen whose whole job is "who else is here" — the question
        // a hat answers. Four pixels is a cheaper price than either a bare
        // roster or a hat in every 30px chat row.
        size={variant === 'roster' || variant === 'standing' ? 40 : 34}
        dimmed={pending}
      />

      <span className={styles.name}>{player.name}</span>

      {host && <Tag>Host</Tag>}
      {you && <Tag tone="neutral">You</Tag>}
      {/* Never optional, and never a caller's decision. Nobody should believe
          a bot is a colleague, so the badge follows the face rather than a
          prop a screen could forget to pass. */}
      {player.bot && <Tag tone="neutral">Bot</Tag>}

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
          {note && <span className={styles.note}>{note}</span>}
          <span className={styles.score}>{score}</span>
        </>
      )}
    </div>
  )
}
