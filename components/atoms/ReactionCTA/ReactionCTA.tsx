'use client'

import type { ButtonHTMLAttributes } from 'react'
import { Icon } from '@/components/atoms/Icon'
import styles from './ReactionCTA.module.scss'

/** `pill` on cards and chat, `rail` is the 44px square in the collapsed rail. */
export type ReactionCTASize = 'pill' | 'rail'

export interface ReactionCTAProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ReactionCTASize
  /** The toolbar this opens is showing. */
  active?: boolean
}

/**
 * The one affordance that opens the reaction toolbar.
 *
 * Always the smiley-plus pair, never a bare `+` — the icon is uniform
 * everywhere it appears so players learn it once. See DESIGNSYSTEM.md §4.4.
 */
export function ReactionCTA({
  size = 'pill',
  active = false,
  type = 'button',
  className,
  ...rest
}: ReactionCTAProps) {
  const classes = [
    styles.cta,
    styles[size],
    active ? styles.active : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      aria-label="Add a reaction"
      aria-expanded={active}
      aria-haspopup="dialog"
      {...rest}
    >
      <Icon name="smiley" size={size === 'rail' ? 19 : 17} />
      <Icon name="plus" size={11} />
    </button>
  )
}
