'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Chip.module.scss'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tints to the accent and marks itself pressed for assistive tech. */
  selected?: boolean
  /**
   * The chip isn't available yet, but stays live and focusable — the same
   * contract `Button` has, for the same reason: an unavailable action says
   * what is missing rather than going grey and inert. See DESIGNSYSTEM.md
   * §4.7.
   *
   * The picker's suggestion chips need it because each one now spends a
   * board off the round's budget, so there is a real "not right now" state
   * they have to be able to express.
   */
  blocked?: boolean
  children: ReactNode
}

/**
 * A search suggestion or filter — "deploy on friday", "merge conflict".
 *
 * Always a real button: chips are tapped, and a selected chip reports
 * `aria-pressed` rather than relying on the tint alone.
 */
export function Chip({
  selected = false,
  blocked = false,
  type = 'button',
  className,
  children,
  ...rest
}: ChipProps) {
  const classes = [
    styles.chip,
    selected ? styles.selected : '',
    blocked ? styles.blocked : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} aria-pressed={selected} {...rest}>
      {children}
    </button>
  )
}
