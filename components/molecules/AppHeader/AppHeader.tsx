import type { ReactNode } from 'react'
import { Tag } from '@/components/atoms/Tag'
import { Wordmark } from '@/components/molecules/Wordmark'
import styles from './AppHeader.module.scss'

export interface AppHeaderProps {
  /**
   * Where the room is — "Round 2 of 5". Omit on the lobby, which shows the
   * settings line instead.
   */
  phase?: string
  /**
   * The step inside that round — "Vote". Sits beside `phase` from `md` up and
   * stands down below it: a phone header cannot hold both, and the round is
   * the half no screen repeats in its own headline.
   */
  step?: string
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
  step,
  settings,
  host = false,
  trailing,
  surface = 'default',
}: AppHeaderProps) {
  return (
    <header className={`${styles.header} ${styles[surface]}`}>
      <div className={styles.left}>
        <Wordmark />
        {host && (
          // In the lobby the settings line is the whole point of this bar —
          // it is how everyone learns the game — and on a phone the chip took
          // exactly the width its last item needed, so the host was the one
          // person who could not read their own room's rules. In a round the
          // line has already stood down and the chip costs nothing, so it
          // stays. Never in-round-only styling: it is the same chip, standing
          // down where something else needs the room more.
          <span className={phase || step ? undefined : styles.roleTag}>
            <Tag>Host</Tag>
          </span>
        )}
        {(phase || step) && (
          <span className={styles.phase}>
            {phase}
            {step && (
              <span className={styles.step}>
                {phase ? ' · ' : ''}
                {step}
              </span>
            )}
          </span>
        )}
      </div>

      {/* One right-hand group, always rendered, so the clock is pinned to the
          right edge whether or not the settings line beside it is displayed. */}
      <div className={styles.right}>
        {settings && (
          // In-round on a phone there is only room for where you are and how
          // long is left, so the settings line stands down for the phase. In
          // the lobby there is no phase, and the settings line is how you learn
          // the game — so it stays.
          // Being in a round is what makes this secondary, not the presence of
          // a round *number*: the scoreboard has no anchor because the pips
          // carry it, and keying off `phase` alone brought the settings line
          // back on the one phone header with the least room for it.
          <span className={`${styles.settings} ${phase || step ? styles.secondary : ''}`}>
            {settings}
          </span>
        )}
        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
    </header>
  )
}
