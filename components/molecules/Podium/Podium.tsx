import { Fragment, type ReactNode } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { Tag } from '@/components/atoms/Tag'
import { botLabel } from '@/lib/bots/personas'
import styles from './Podium.module.scss'
import type { PlayerFace } from '@/lib/game/types'

export interface PodiumPlace {
  player: PlayerFace
  score: number
}

export interface PodiumProps {
  /** First, second and third. Third is optional in a very small room. */
  first: PodiumPlace
  second: PodiumPlace
  third?: PodiumPlace
}

/**
 * A break opportunity at the underscore, adding no characters.
 *
 * A hired bot is called `Adjective_Noun` and runs to twenty characters —
 * longer than any pedestal can be without pushing the podium off a phone, so
 * a long one has to wrap. As far as the browser is concerned it is one word,
 * and it breaks at whichever letter lands on the edge ("Panicked_Laten /
 * cy").
 *
 * `<wbr>` rather than a zero-width space, and the difference matters: a ZWSP
 * is a real character, so it would ride along into `textContent`, into
 * anything anyone copies, and into every future assertion on a player's name —
 * a trap that fails confusingly and long after the fact. `<wbr>` contributes
 * nothing to the text and only offers the line breaker somewhere to go.
 */
function breakable(name: string): ReactNode {
  return name.split('_').map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          {'_'}
          <wbr />
        </>
      )}
      {part}
    </Fragment>
  ))
}

/**
 * The final three, after round five.
 *
 * Ordered second-first-third visually so the winner stands in the middle, but
 * the DOM order is 1-2-3 — a screen reader should hear the standings, not the
 * stagecraft.
 */
export function Podium({ first, second, third }: PodiumProps) {
  return (
    <ol className={styles.podium}>
      <li className={`${styles.place} ${styles.first}`}>
        <Avatar {...first.player} size={56} selected />
        <div className={styles.block}>
          <span className={styles.rank}>1</span>
          <span className={styles.name}>{breakable(first.player.name)}</span>
          {first.player.bot && (
            <span className={styles.badge}>
              <Tag tone="neutral">{botLabel(first.player.bot)}</Tag>
            </span>
          )}
          <span className={styles.score}>{first.score} pts</span>
        </div>
      </li>

      <li className={`${styles.place} ${styles.second}`}>
        <Avatar {...second.player} size={40} />
        <div className={styles.block}>
          <span className={styles.rank}>2</span>
          <span className={styles.name}>{breakable(second.player.name)}</span>
          {second.player.bot && (
            <span className={styles.badge}>
              <Tag tone="neutral">{botLabel(second.player.bot)}</Tag>
            </span>
          )}
          <span className={styles.score}>{second.score} pts</span>
        </div>
      </li>

      {third && (
        <li className={`${styles.place} ${styles.third}`}>
          <Avatar {...third.player} size={40} />
          <div className={styles.block}>
            <span className={styles.rank}>3</span>
            <span className={styles.name}>{breakable(third.player.name)}</span>
          {third.player.bot && (
            <span className={styles.badge}>
              <Tag tone="neutral">{botLabel(third.player.bot)}</Tag>
            </span>
          )}
            <span className={styles.score}>{third.score} pts</span>
          </div>
        </li>
      )}
    </ol>
  )
}
