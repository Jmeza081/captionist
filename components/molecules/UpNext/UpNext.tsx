import { Avatar, type AvatarProps } from '@/components/atoms/Avatar'
import styles from './UpNext.module.scss'

export interface UpNextProps {
  /** Whoever holds the role now — the pill is "up next *after* them". */
  after: string
  /** The next holders, in the order they will actually take it. */
  players: AvatarProps[]
  /** The quiet clause after the faces — what the order actually means. */
  note: string
}

/**
 * "Up next after Vic" — the queue, as a pill.
 *
 * The design puts this under the waiting wall, and its own note says why: the
 * wait is *"the moment the room learns who to blame for the image"*, so it is
 * also the moment to say who they will be blaming next.
 *
 * **The note is not the design's.** The artboard reads "order is randomised
 * each round", and the rotation is `roleHolderIndex` modulo a roster held in
 * join order — deterministic, and the same every game. A caption that made the
 * queue sound like a shuffle would be a line the room could catch us out on by
 * round three, so it says what the faces beside it actually mean.
 *
 * The faces overlap, and each one is ringed in the page's own colour rather
 * than a border tone, so the stack reads as a stack without inventing an edge.
 */
export function UpNext({ after, players, note }: UpNextProps) {
  if (players.length === 0) return null

  return (
    <div className={styles.pill}>
      <span className={styles.label}>Up next after {after}</span>
      <span className={styles.divider} aria-hidden="true" />
      {/* One image for the row rather than one label per face: three
          separately-announced avatars is three stops on the way past what is,
          to a reader, a single fact — who is next, in what order. */}
      <span
        className={styles.stack}
        role="img"
        aria-label={`Then ${players.map((player) => player.name).join(', ')}`}
      >
        {players.map((player, i) => (
          <span
            key={player.name}
            className={styles.face}
            // Later faces sit under earlier ones, so the queue reads left to
            // right rather than the last one covering the next one up.
            style={{ zIndex: players.length - i }}
            aria-hidden="true"
          >
            <Avatar {...player} size={26} />
          </span>
        ))}
      </span>
      <span className={styles.note}>{note}</span>
    </div>
  )
}
