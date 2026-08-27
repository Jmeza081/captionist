'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.scss'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'ghost'

/** `form` is the 51px CTA that advances a phase; `toolbox` is the host's compact key. */
export type ButtonSize = 'inline' | 'form' | 'toolbox'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. Use exactly one `primary` per screen — the one that advances the phase. */
  variant?: ButtonVariant
  size?: ButtonSize
  /** Stretch to the width of the container. Common on mobile. */
  fullWidth?: boolean
  /**
   * The action isn't available yet, but the control stays live and focusable.
   * Say what's missing in the label — "Pick 2 more", not a greyed-out button.
   * This is not `disabled`; see DESIGNSYSTEM.md §4.7.
   */
  blocked?: boolean
  children: ReactNode
}

/**
 * The only button in the app.
 *
 * Need a new look? Add a `variant` here rather than creating a sibling
 * component — see components/README.md.
 */
export function Button({
  variant = 'primary',
  size = 'inline',
  fullWidth = false,
  blocked = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size === 'inline' ? '' : styles[size],
    fullWidth ? styles.fullWidth : '',
    blocked ? styles.blocked : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
