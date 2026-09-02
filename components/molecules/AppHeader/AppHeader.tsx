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
        {/* The lobby is the bar with no phase and no clock, so it is the one
            with room for the name — and the one screen where saying what the
            app is called earns its place. */}
        <Wordmark showName={!phase && !step} />
        {/* At every width now. It used to stand down on the lobby's phone bar,
            because the settings line was in there competing for the same
            pixels and the host was the one person who could not read their own
            room's rules. The rules read off the share card instead. */}
        {host && <Tag>Host</Tag>}
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
          //
          // Out of a phone bar either way now. In a round the phase takes the
          // room; in the lobby the name, the host chip and the walkthrough key
          // take it, and the rules read off the share card instead — which is
          // where somebody about to send the link is already looking.
          <span className={styles.settings}>{settings}</span>
        )}
        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
    </header>
  )
}
