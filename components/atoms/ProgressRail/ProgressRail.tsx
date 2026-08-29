import styles from './ProgressRail.module.scss'

export interface ProgressRailProps {
  /** 0–1. Clamped, so a late tick can't overflow the rail. */
  fraction: number
  /** Matches the timer pill going red at 15s. */
  urgent?: boolean
  label?: string
  /**
   * `header` is the 3px hairline under the room's header. `bar` is the thicker,
   * rounded one the reconnect overlay counts a held seat down with — same
   * mechanics, same colours, twice the height and a radius.
   */
  size?: 'header' | 'bar'
  /**
   * `default` is the countdown's white fill. `accent` is the boot
   * interstitial's, where the rail measures work rather than time and the
   * design puts it in the same purple as the ring above it.
   */
  tone?: 'default' | 'accent'
}

/**
 * A rail that drains with a deadline.
 *
 * Presentational: the timer pill already announces the time, so this is
 * hidden from assistive tech unless given a label.
 */
export function ProgressRail({
  fraction,
  urgent = false,
  label,
  size = 'header',
  tone = 'default',
}: ProgressRailProps) {
  const pct = Math.min(100, Math.max(0, fraction * 100))

  return (
    <div
      className={`${styles.rail} ${styles[size]}`}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
    >
      <div
        className={`${styles.fill} ${styles[tone]} ${urgent ? styles.urgent : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
