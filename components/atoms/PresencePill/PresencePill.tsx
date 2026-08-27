import styles from './PresencePill.module.scss'

export interface PresencePillProps {
  /** How many players are currently in the room. */
  count: number
}

/**
 * "7 here" — live room presence.
 *
 * The dot is decorative; the count carries the meaning, so colour is never
 * the only signal.
 */
export function PresencePill({ count }: PresencePillProps) {
  return (
    <span className={styles.pill}>
      <span className={styles.dot} aria-hidden="true" />
      {count} here
    </span>
  )
}
