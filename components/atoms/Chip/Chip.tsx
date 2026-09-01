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
   * The picker's suggestion chips were the first case: each one spent a board
   * off the round's search budget. That budget is gone (ADR-0026) and the prop
   * stays, because the contract is the design system's rather than the
   * picker's — see the gallery, which is where it is demonstrated now.
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
