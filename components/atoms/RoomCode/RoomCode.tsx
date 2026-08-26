import styles from './RoomCode.module.scss'

export interface RoomCodeProps {
  /** The room code, e.g. `C-F34213`. */
  code: string
}

/**
 * Displays a room code for reading aloud and typing by hand.
 *
 * Rendered in tabular monospace with wide tracking so `0`/`O` and `1`/`I`
 * stay distinguishable, and announced as a spelled-out string so screen
 * readers don't read it as a word.
 */
export function RoomCode({ code }: RoomCodeProps) {
  return (
    <p className={styles.roomCode}>
      <span aria-hidden="true">{code}</span>
      <span className={styles.srOnly}>
        Room code: {code.split('').join(' ')}
      </span>
    </p>
  )
}
