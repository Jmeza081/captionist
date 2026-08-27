import { Icon } from '@/components/atoms/Icon'
import styles from './Snackbar.module.scss'

export interface SnackbarProps {
  /** What just happened — "Room link copied", "Invite posted to #eng-standup". */
  message: string
}

/**
 * Confirmation for an action with no other visible result.
 *
 * Required after copy, share, mode switch and upload-accepted, per
 * DESIGNSYSTEM.md §4.2. One at a time; the host decides when it leaves.
 *
 * Announced politely rather than assertively — it confirms something the
 * player just did, so it shouldn't interrupt them.
 */
export function Snackbar({ message }: SnackbarProps) {
  return (
    <div className={styles.snackbar} role="status" aria-live="polite">
      <span className={styles.check}>
        <Icon name="check" size={13} />
      </span>
      {message}
    </div>
  )
}
