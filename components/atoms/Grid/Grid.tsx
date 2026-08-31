import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import { optionalSpace, type SpaceToken } from '@/theme/tokens'
import styles from './Grid.module.scss'

export interface GridProps extends HTMLAttributes<HTMLElement> {
  /** Columns on phones. Defaults to 1 — mobile-first. */
  columns?: number
  /** Columns from the `md` breakpoint up. Omit to keep the mobile count. */
  mdColumns?: number
  /**
   * Drops the `md` breakpoint and lets the column count fall out of the width
   * this grid actually has, capped at `mdColumns`.
   *
   * **Use it for anything inside the room's content column**, which is the
   * window minus the docked chat rail — a viewport query cannot see that 360px
   * and put three vote cards into 288px of space.
   *
   * The cell minimum comes from `--grid-min`, which the caller sets from a
   * token in its own stylesheet — the number is a measure, and measures live in
   * `theme/`. Without one the grid stays a single column, which is wrong in a
   * way you can see rather than wrong by a hundred pixels.
   */
  fluid?: boolean
  gap?: SpaceToken
  padding?: SpaceToken
  as?: ElementType
  children: ReactNode
}

/**
 * Two-dimensional layout, for when `Stack` and `Inline` aren't enough — a set
 * of cards, a caption transcript with timestamps.
 *
 * Starts at one column and reflows rather than stretching, per
 * docs/design-system.md §2.7 — at `md` by default, or on its own width with
 * `fluid`.
 */
export function Grid({
  columns = 1,
  mdColumns,
  fluid = false,
  gap,
  padding,
  as,
  className,
  style,
  children,
  ...rest
}: GridProps) {
  const Component = (as ?? 'div') as ElementType

  const classes = [styles.grid, fluid ? styles.fluid : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  const vars = {
    '--grid-columns': String(columns),
    '--grid-columns-md': String(mdColumns ?? columns),
    ...(fluid ? { '--grid-cap': String(mdColumns ?? columns) } : {}),
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
