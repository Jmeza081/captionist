import styles from './RoomCode.module.scss'

export interface RoomCodeProps {
  /** The room code, e.g. `C-F34213`. */
  code: string
  /**
   * `display` is the entry screen's, sized to the viewport. `compact` is the
   * lobby's, sitting beside the QR inside a fixed-width column — where a
   * viewport-scaled size would simply overflow.
   */
  size?: 'display' | 'compact'
}

/**
 * Displays a room code for reading aloud and typing by hand.
 *
 * Rendered in tabular monospace with wide tracking so `0`/`O` and `1`/`I`
 * stay distinguishable, and announced as a spelled-out string so screen
 * readers don't read it as a word.
 */
export function RoomCode({ code, size = 'display' }: RoomCodeProps) {
  return (
    <p className={`${styles.roomCode} ${styles[size]}`} data-testid="room-code">
      <span aria-hidden="true">{code}</span>
      <span className={styles.srOnly}>
        Room code: {code.split('').join(' ')}
      </span>
    </p>
  )
}
