import styles from './UnreadDivider.module.scss'

export interface UnreadDividerProps {
  /** How many messages arrived while you were away. */
  count: number
}

/** The accent rule marking where you stopped reading. */
export function UnreadDivider({ count }: UnreadDividerProps) {
  return (
    <div className={styles.divider} role="separator">
      <span className={styles.rule} />
      <span className={styles.pill}>{count} new</span>
      <span className={styles.rule} />
    </div>
  )
}
