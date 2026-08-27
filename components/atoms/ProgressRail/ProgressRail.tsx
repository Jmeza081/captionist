import styles from './ProgressRail.module.scss'

export interface ProgressRailProps {
  /** 0–1. Clamped, so a late tick can't overflow the rail. */
  fraction: number
  /** Matches the timer pill going red at 15s. */
  urgent?: boolean
  label?: string
}

/**
 * The 3px rail under the header that drains with the round timer.
 *
 * Presentational: the timer pill already announces the time, so this is
 * hidden from assistive tech unless given a label.
 */
export function ProgressRail({
  fraction,
  urgent = false,
  label,
}: ProgressRailProps) {
  const pct = Math.min(100, Math.max(0, fraction * 100))

  return (
    <div
      className={styles.rail}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
    >
      <div
        className={`${styles.fill} ${urgent ? styles.urgent : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
