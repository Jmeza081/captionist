import type { ElementType, ReactNode } from 'react'
import styles from './Eyebrow.module.scss'

export type EyebrowTone = 'accent' | 'muted' | 'winner' | 'urgent'

export interface EyebrowProps {
  /**
   * `accent` is the default PROMPT/ROUND marker and `muted` recedes on a card.
   * `winner` and `urgent` are the two the design gives their own colour: gold
   * on the reveal and the podium, red on sudden death — in both cases the
   * eyebrow is the first thing that says what kind of moment this is.
   */
  tone?: EyebrowTone
  as?: ElementType
  /** For the screen to place it — never to restyle it. */
  className?: string
  children: ReactNode
}

/**
 * The small, wide, uppercase marker above a heading — "Prompt", "Round 2 of 5".
 *
 * Uppercasing happens in CSS so the source string stays readable and screen
 * readers pronounce it as words rather than letters.
 */
export function Eyebrow({ tone = 'accent', as, className, children }: EyebrowProps) {
  const Component = (as ?? 'span') as ElementType
  return (
    <Component className={`${styles.eyebrow} ${styles[tone]} ${className ?? ''}`}>
      {children}
    </Component>
  )
}
