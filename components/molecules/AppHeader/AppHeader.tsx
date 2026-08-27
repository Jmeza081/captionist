import type { ReactNode } from 'react'
import { Tag } from '@/components/atoms/Tag'
import styles from './AppHeader.module.scss'

export interface AppHeaderProps {
  /**
   * Where the room is — "Round 2 of 5 · Vote". Omit on the lobby, which shows
   * the settings line instead.
   */
  phase?: string
  /**
   * The room's settings, mode first. This is how a late joiner learns which
   * way round the game runs, so the mode always leads.
   */
  settings?: string
  /** Marks the viewer as the host. */
  host?: boolean
  /** The timer pill or the room code. */
  trailing?: ReactNode
  /** `vote` swaps the hairline for a filled bar. */
  surface?: 'default' | 'vote'
}

/**
 * The bar across the top of every in-room screen.
 *
 * Carries the phase on the left and the clock on the right, so the two things
 * a player checks mid-round are always in the same place.
 */
export function AppHeader({
  phase,
  settings,
  host = false,
  trailing,
  surface = 'default',
}: AppHeaderProps) {
  return (
    <header className={`${styles.header} ${styles[surface]}`}>
      <div className={styles.left}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.wordmark}>Captionist</span>
        {host && <Tag>Host</Tag>}
        {phase && <span className={styles.phase}>{phase}</span>}
      </div>

      {settings && (
        // In-round on a phone there is only room for where you are and how
        // long is left, so the settings line stands down for the phase. In the
        // lobby there is no phase, and the settings line is how you learn the
        // game — so it stays.
        <span className={`${styles.settings} ${phase ? styles.secondary : ''}`}>
          {settings}
        </span>
      )}
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </header>
  )
}
