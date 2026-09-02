import { Icon } from '@/components/atoms/Icon'
import styles from './Snackbar.module.scss'

/** What kind of thing just happened. */
export type SnackbarTone = 'confirm' | 'warning'

export interface SnackbarProps {
  /** What just happened — "Room link copied", "Invite posted to #eng-standup". */
  message: string
  /**
   * `confirm` is the green tick: something you did, and it worked.
   *
   * `warning` is the room saying no — "Need 2 more players." Those arrive on
   * the same dock through the same queue, and until this existed they arrived
   * wearing the same tick, which told somebody their blocked action had
   * succeeded. A prop rather than a sibling component: it is one plate with two
   * marks on it.
   */
  tone?: SnackbarTone
}

/**
 * Confirmation for an action with no other visible result.
 *
 * Required after copy, share and mode switch, per DESIGNSYSTEM.md §4.2. One
 * at a time; the host decides when it leaves.
 *
 * A confirmation is announced politely — it confirms something the player just
 * did, so it shouldn't interrupt them. A `warning` is announced assertively,
 * because it is the room refusing something they just tried.
 */
export function Snackbar({ message, tone = 'confirm' }: SnackbarProps) {
  const warning = tone === 'warning'

  return (
    <div
      className={`${styles.snackbar} ${warning ? styles.warning : ''}`}
      role="status"
      // A refusal is worth interrupting for: it is the answer to something you
      // just tried and could not do. A confirmation is not.
      aria-live={warning ? 'assertive' : 'polite'}
    >
      <span className={styles.mark}>
        <Icon name={warning ? 'warning' : 'check'} size={13} />
      </span>
      {message}
    </div>
  )
}
