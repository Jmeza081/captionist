import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import {
  optionalRadius,
  optionalSpace,
  type RadiusToken,
  type SpaceToken,
} from '@/theme/tokens'
import styles from './Box.module.scss'

export type BoxBackground =
  | 'none'
  | 'lobby'
  | 'vote'
  | 'modal'
  | 'card'
  | 'field'
  | 'light'

export interface BoxProps extends HTMLAttributes<HTMLElement> {
  padding?: SpaceToken
  radius?: RadiusToken
  /**
   * A named surface from the palette. `light` paints white — only for content
   * a camera has to read, like a QR code.
   */
  background?: BoxBackground
  as?: ElementType
  children: ReactNode
}

/**
 * A surface: padding, a radius, and optionally a background step.
 *
 * Use it instead of adding `padding` and `background-color` to a bespoke class.
 * If you need it to lay its children out too, put a `Stack` or `Inline` inside.
 */
export function Box({
  padding,
  radius,
  background = 'none',
  as,
  className,
  style,
  children,
  ...rest
}: BoxProps) {
  const Component = (as ?? 'div') as ElementType

  const classes = [styles.box, styles[background], className ?? '']
    .filter(Boolean)
    .join(' ')

  const vars = {
    '--box-padding': optionalSpace(padding),
    '--box-radius': optionalRadius(radius),
    ...style,
  } as CSSProperties

  return (
    <Component className={classes} style={vars} {...rest}>
      {children}
    </Component>
  )
}
