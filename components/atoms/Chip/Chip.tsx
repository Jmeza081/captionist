'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Chip.module.scss'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tints to the accent and marks itself pressed for assistive tech. */
  selected?: boolean
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
  type = 'button',
  className,
  children,
  ...rest
}: ChipProps) {
  const classes = [styles.chip, selected ? styles.selected : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} aria-pressed={selected} {...rest}>
      {children}
    </button>
  )
}
