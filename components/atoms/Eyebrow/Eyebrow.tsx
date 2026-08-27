import type { ElementType, ReactNode } from 'react'
import styles from './Eyebrow.module.scss'

export type EyebrowTone = 'accent' | 'muted'

export interface EyebrowProps {
  /** `accent` is the default PROMPT/ROUND marker; `muted` recedes on a card. */
  tone?: EyebrowTone
  as?: ElementType
  children: ReactNode
}

/**
 * The small, wide, uppercase marker above a heading — "Prompt", "Round 2 of 5".
 *
 * Uppercasing happens in CSS so the source string stays readable and screen
 * readers pronounce it as words rather than letters.
 */
export function Eyebrow({ tone = 'accent', as, children }: EyebrowProps) {
  const Component = (as ?? 'span') as ElementType
  return (
    <Component className={`${styles.eyebrow} ${styles[tone]}`}>
      {children}
    </Component>
  )
}
