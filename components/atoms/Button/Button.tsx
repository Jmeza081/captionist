'use client'

import Link from 'next/link'
import type React from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.scss'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'ghost'

/** `form` is the 51px CTA that advances a phase; `toolbox` is the host's compact key. */
export type ButtonSize = 'inline' | 'small' | 'form' | 'toolbox'

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
  /**
   * Renders a link that looks like a button, for an action that is really a
   * navigation. An anchor rather than a `router.push` so it opens in a new
   * tab, previews on hover, and works before hydration — none of which a
   * `<button>` with an onClick gives you.
   *
   * `blocked` still tints the control but means nothing on a link: there is no
   * "not yet" state for somewhere you can simply go.
   */
  href?: string
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
  href,
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

  if (href) {
    // Everything else is forwarded: dropping `onClick`, `id` or a `data-`
    // attribute here would typecheck and then silently do nothing, which is a
    // worse trap than not supporting them. `disabled` and `type` are the two
    // that genuinely have no meaning on an anchor.
    // `disabled` is pulled out precisely so it cannot reach the anchor, where
    // it would be meaningless.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { disabled, ...anchor } = rest
    return (
      <Link
        {...(anchor as Omit<React.ComponentPropsWithoutRef<typeof Link>, 'href'>)}
        href={href}
        className={classes}
      >
        {children}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
