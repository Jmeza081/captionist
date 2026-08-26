'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. Use exactly one `primary` per view. */
  variant?: ButtonVariant
  size?: ButtonSize
  /** Stretch to the width of the container. Common on mobile. */
  fullWidth?: boolean
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
  size = 'md',
  fullWidth = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
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
