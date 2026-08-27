import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import {
  alignClass,
  justifyClass,
  optionalSpace,
  type Align,
  type Justify,
  type SpaceToken,
} from '@/theme/tokens'
import styles from './Stack.module.scss'

export interface StackProps extends HTMLAttributes<HTMLElement> {
  /** Space between children, as a step on the 4px scale. */
  gap?: SpaceToken
  /** Padding on all sides. */
  padding?: SpaceToken
  align?: Align
  justify?: Justify
  /** Element to render. Use it to keep the markup semantic — `section`, `ul`, `main`. */
  as?: ElementType
  children: ReactNode
}

/**
 * Vertical layout. The default way to space a column of things.
 *
 * Spacing goes on the container, never as margins on the children — see
 * docs/design-system.md §2.6. Reach for `Inline` when the axis is horizontal.
 */
export function Stack({
  gap,
  padding,
  align,
  justify,
  as,
  className,
  style,
  children,
  ...rest
}: StackProps) {
  const Component = (as ?? 'div') as ElementType

  const classes = [
    styles.stack,
    align ? styles[alignClass(align)] : '',
    justify ? styles[justifyClass(justify)] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const vars = {
    '--stack-gap': optionalSpace(gap),
    '--stack-padding': optionalSpace(padding),
    ...style,
  } as CSSProperties

  return (
    <Component className={classes} style={vars} {...rest}>
      {children}
    </Component>
  )
}
