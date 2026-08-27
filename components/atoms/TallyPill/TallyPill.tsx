import type { ReactNode } from 'react'
import styles from './TallyPill.module.scss'

export type TallyContext = 'media' | 'chat'

export interface TallyPillProps {
  /** The emoji or a small <img> for a Slackmoji GIF. */
  glyph: ReactNode
  count: number
  /** You reacted with this one — gains an accent border and lighter count. */
  mine?: boolean
  /** `media` sits over an image and needs the scrim; `chat` sits on a surface. */
  context?: TallyContext
  label: string
}

/**
 * The running count of one reaction.
 *
 * Over media it carries its own scrim and blur, because it has to stay legible
 * on top of an arbitrary GIF.
 */
export function TallyPill({
  glyph,
  count,
  mine = false,
  context = 'media',
  label,
}: TallyPillProps) {
  const classes = [styles.tally, styles[context], mine ? styles.mine : '']
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes}>
      <span aria-hidden="true" className={styles.glyph}>
        {glyph}
      </span>
      <span className={styles.count}>{count}</span>
      <span className={styles.srOnly}>
        {label}, {count} {count === 1 ? 'reaction' : 'reactions'}
        {mine ? ', including yours' : ''}
      </span>
    </span>
  )
}
