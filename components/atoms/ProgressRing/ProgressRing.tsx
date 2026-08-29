import type { ReactNode } from 'react'
import styles from './ProgressRing.module.scss'

export interface ProgressRingProps {
  /** What the ring is drawn around — an avatar, the app's mark, nothing. */
  children?: ReactNode
  /**
   * `badge` is the interstitial's 116px ring around a face or a mark. `inline`
   * is the 16px one a checklist row carries in place of a check.
   */
  size?: 'badge' | 'inline'
  /** Stops the rotation and completes the circle, for a step that is done. */
  still?: boolean
}

/**
 * An indeterminate arc, spinning around whatever it is given.
 *
 * Deliberately not a prop on `Avatar`: the host's interstitial rings the app's
 * mark rather than a face, so a ring that could only wrap an avatar would be
 * half a component. It wraps `children` instead and knows nothing about them.
 *
 * Presentational — the checklist beside it already says what is happening, and
 * two announcements of one fact is worse than none.
 */
export function ProgressRing({ children, size = 'badge', still = false }: ProgressRingProps) {
  return (
    <span className={`${styles.ring} ${styles[size]}`} aria-hidden="true">
      <span className={`${styles.arc} ${still ? styles.still : ''}`} />
      {children && <span className={styles.slot}>{children}</span>}
    </span>
  )
}
