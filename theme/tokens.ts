/**
 * Design tokens, reachable from React.
 *
 * This module deliberately contains **no values**. Every number lives in
 * `theme/_spacing.scss` and reaches the browser as a CSS custom property via
 * `theme/_css-vars.scss`. What's exported here is the set of legal token
 * *names* plus the `var()` references that point at them — so `gap={12}` is
 * type-checked, and changing a value is still a one-line edit in Sass.
 *
 * The scale is not a 4px grid. It's the uneven set the design specifies, and
 * each token is named for its own pixel value: `12` is 12px. `gap={13}` is a
 * type error precisely because 13px isn't in the design.
 *
 * In a `.module.scss`, keep using `t.$space-12`. This is only for the layout
 * primitives, which need to accept a token as a prop.
 */

export const SPACE_TOKENS = [
  0, 2, 5, 6, 8, 10, 12, 14, 20, 26, 34, 44, 52,
] as const

/** A step on the spacing scale, named for its pixel value. */
export type SpaceToken = (typeof SPACE_TOKENS)[number]

export const RADIUS_TOKENS = [
  'pill',
  'modal',
  'card',
  'field',
  'field-lg',
  'toolbox',
  'media',
  'media-lg',
  'pip',
  'avatar',
] as const

/** A radius, named for the surface it wraps. */
export type RadiusToken = (typeof RADIUS_TOKENS)[number]

/** `space(12)` → `var(--space-12)`. */
export function space(token: SpaceToken): string {
  return `var(--space-${token})`
}

/** `radius('card')` → `var(--radius-card)`. */
export function radius(token: RadiusToken): string {
  return `var(--radius-${token})`
}

/**
 * Resolves an optional token prop to a `var()` reference, or `undefined` so the
 * custom property falls back to the value baked into the primitive's stylesheet.
 */
export function optionalSpace(
  token: SpaceToken | undefined,
): string | undefined {
  return token === undefined ? undefined : space(token)
}

export function optionalRadius(
  token: RadiusToken | undefined,
): string | undefined {
  return token === undefined ? undefined : radius(token)
}

/** Cross-axis alignment, shared by `Stack` and `Inline`. */
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline'

/** Main-axis distribution, shared by `Stack` and `Inline`. */
export type Justify = 'start' | 'center' | 'end' | 'between'

/**
 * `'center'` → `'alignCenter'`, matching the classes emitted by
 * `theme/_layout.scss`. Shared so `Stack` and `Inline` agree on the mapping.
 */
export function alignClass(align: Align): string {
  return `align${capitalise(align)}`
}

/** `'between'` → `'justifyBetween'`. */
export function justifyClass(justify: Justify): string {
  return `justify${capitalise(justify)}`
}

function capitalise(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
