import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import {
  alignClass,
  justifyClass,
  optionalSpace,
  type Align,
  type Justify,
  type SpaceToken,
} from '@/theme/tokens'
import styles from './Inline.module.scss'

export interface InlineProps extends HTMLAttributes<HTMLElement> {
  /** Space between children, as a step on the 4px scale. */
  gap?: SpaceToken
  /** Padding on all sides. */
  padding?: SpaceToken
  /** Defaults to `center` — the common case for a row of controls. */
  align?: Align
  justify?: Justify
  /** Let children wrap onto a second line. On by default: phones are narrow. */
  wrap?: boolean
  as?: ElementType
  children: ReactNode
}

/**
 * Horizontal layout. A row of things with consistent spacing between them.
 *
 * Wraps by default — a row that fits at 1440px rarely fits at 393px, and
 * silent overflow is worse than a second line.
 */
export function Inline({
  gap,
  padding,
  align = 'center',
  justify,
  wrap = true,
  as,
  className,
  style,
  children,
  ...rest
}: InlineProps) {
  const Component = (as ?? 'div') as ElementType

  const classes = [
    styles.inline,
    wrap ? styles.wrap : '',
    styles[alignClass(align)],
    justify ? styles[justifyClass(justify)] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const vars = {
    '--inline-gap': optionalSpace(gap),
    '--inline-padding': optionalSpace(padding),
    ...style,
  } as CSSProperties

  return (
    <Component className={classes} style={vars} {...rest}>
      {children}
    </Component>
  )
}
