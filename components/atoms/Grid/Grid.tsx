import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import { optionalSpace, type SpaceToken } from '@/theme/tokens'
import styles from './Grid.module.scss'

export interface GridProps extends HTMLAttributes<HTMLElement> {
  /** Columns on phones. Defaults to 1 — mobile-first. */
  columns?: number
  /** Columns from the `md` breakpoint up. Omit to keep the mobile count. */
  mdColumns?: number
  gap?: SpaceToken
  padding?: SpaceToken
  as?: ElementType
  children: ReactNode
}

/**
 * Two-dimensional layout, for when `Stack` and `Inline` aren't enough — a set
 * of cards, a caption transcript with timestamps.
 *
 * Starts at one column and reflows at `md` rather than stretching, per
 * docs/design-system.md §2.7.
 */
export function Grid({
  columns = 1,
  mdColumns,
  gap,
  padding,
  as,
  className,
  style,
  children,
  ...rest
}: GridProps) {
  const Component = (as ?? 'div') as ElementType

  const classes = [styles.grid, className ?? ''].filter(Boolean).join(' ')

  const vars = {
    '--grid-columns': String(columns),
    '--grid-columns-md': String(mdColumns ?? columns),
    '--grid-gap': optionalSpace(gap),
    '--grid-padding': optionalSpace(padding),
    ...style,
  } as CSSProperties

  return (
    <Component className={classes} style={vars} {...rest}>
      {children}
    </Component>
  )
}
