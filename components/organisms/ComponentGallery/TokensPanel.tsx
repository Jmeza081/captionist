'use client'

import { Box } from '@/components/atoms/Box'
import { Stack } from '@/components/atoms/Stack'
import {
  RADIUS_TOKENS,
  SPACE_TOKENS,
  radius,
  space,
} from '@/theme/tokens'
import { Case, Section } from './Section'
import styles from './ComponentGallery.module.scss'

/**
 * The scale, drawn at the size it actually is.
 *
 * Every swatch below is sized from a `var()` reference rather than a number in
 * this file — `theme/tokens.ts` exports names, `theme/_css-vars.scss` publishes
 * the values, and `e2e/tokens.spec.ts` guards the bridge between them. So this
 * panel cannot show a value the app is not using: if the Sass changes, the bars
 * change with it.
 *
 * Colour and type are not here, and that is the same rule rather than an
 * omission: they live in Sass and are never published as custom properties, so
 * a swatch grid would have to restate sixty-four hex values in a second place.
 * The components on the other tabs are the palette, drawn in use.
 */

/** The two published metrics that are neither space nor radius. */
const METRICS = [
  {
    name: '--tap-target-min',
    note: 'The floor for anything a finger has to hit.',
  },
  {
    name: '--rail-width',
    note: 'Chat, docked beside the room from `md` up.',
  },
  {
    name: '--rail-width-collapsed',
    note: 'The same rail as a strip, still carrying its unread badge.',
  },
] as const

export function TokensPanel() {
  return (
    <>
      <Section id="spacing">
        <Case label="The scale — thirteen steps, each named for its own pixel value">
          <p className={styles.note}>
            <strong className={styles.strong}>Not a 4px grid.</strong> It is the
            uneven set the design specifies, so{' '}
            <code className={styles.code}>gap={'{13}'}</code> is a type error rather
            than a rounding decision.
          </p>
          <Stack gap={8} className={styles.scaleTable}>
            {SPACE_TOKENS.map((token) => (
              <div key={token} className={styles.scaleRow}>
                <code className={styles.scaleName}>{token}</code>
                <span className={styles.scaleBar} style={{ width: space(token) }} />
                <span className={styles.scaleValue}>{token}px</span>
              </div>
            ))}
          </Stack>
        </Case>
      </Section>

      <Section id="radii">
        <Case label="Named for the surface it wraps, not the number it is">
          <div className={styles.tileGrid}>
            {RADIUS_TOKENS.map((token) => (
              <figure key={token} className={styles.tile}>
                <span
                  className={styles.radiusSwatch}
                  style={{ borderRadius: radius(token) }}
                />
                <figcaption className={styles.tileLabel}>{token}</figcaption>
              </figure>
            ))}
          </div>
        </Case>
      </Section>

      <Section id="metrics">
        <Case label="Published because CSS decides them, not React">
          <Box background="card" radius="card" padding={20}>
            <Stack gap={14} className={styles.scaleTable}>
              {METRICS.map(({ name, note }) => (
                <div key={name} className={styles.scaleRow}>
                  <code className={styles.scaleName}>{name}</code>
                  <span className={styles.scaleBar} style={{ width: `var(${name})` }} />
                  <span className={styles.scaleNote}>{note}</span>
                </div>
              ))}
            </Stack>
          </Box>
        </Case>
      </Section>
    </>
  )
}
