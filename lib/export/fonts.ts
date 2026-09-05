/**
 * What a canvas has to be told that a stylesheet already knows.
 *
 * A `<canvas>` reads no CSS: it needs a font family by name, sizes in pixels
 * and colours as strings. All three live in the theme, so this module reads
 * them back off the document rather than keeping a second copy — the one
 * rule (`tokens flow Sass → custom properties → TS`) applied to a renderer.
 */

/**
 * The typeface, as `next/font` named it.
 *
 * `--font-inter` is set on `<html>` by `app/layout.tsx` and holds the
 * generated family list (`'__Inter_abc123', '__Inter_Fallback_abc123'`), which
 * is exactly what `ctx.font` wants. The fallback is for the gallery and any
 * test that mounts a renderer outside the layout.
 */
export function fontFamily(): string {
  const declared = getComputedStyle(document.documentElement).getPropertyValue('--font-inter').trim()
  return declared.length > 0 ? declared : 'Inter, system-ui, sans-serif'
}

/**
 * Wait for the weights the export draws in.
 *
 * `document.fonts.load` resolves once the face is usable by a canvas; without
 * it the first frame is drawn in the fallback and the second in Inter, which
 * is a flicker baked into a file forever.
 */
export async function loadFonts(family: string, weights: readonly number[] = [600, 700, 800]): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  await Promise.all(weights.map((weight) => document.fonts.load(`${weight} 16px ${family}`)))
}

/**
 * The caption's four type steps, in pixels, at a given card width.
 *
 * The steps are `clamp(…, Ncqw, …)` — sized against a container — so the
 * only thing that can turn one into a number is a container of that width.
 * This makes one, invisibly, reads the four sizes off it, and removes it.
 */
export function overlayPxAt(width: number): (step: 1 | 2 | 3 | 4) => number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;container-type:inline-size;width:${width}px`
  const spans = ([1, 2, 3, 4] as const).map((step) => {
    const span = document.createElement('span')
    span.style.fontSize = `var(--media-overlay-size-${step})`
    span.textContent = 'x'
    probe.appendChild(span)
    return span
  })
  document.body.appendChild(probe)
  const sizes = spans.map((span) => parseFloat(getComputedStyle(span).fontSize))
  probe.remove()
  return (step) => {
    const px = sizes[step - 1]
    return px !== undefined && Number.isFinite(px) && px > 0 ? px : 16
  }
}

export interface Paint {
  canvas: string
  card: string
  textPrimary: string
  textLabel: string
  textMeta: string
  accentText: string
  winner: string
  hairline: string
}

/**
 * The colours an export is painted with, read off `:root`.
 *
 * Throws rather than defaulting: a renamed token would otherwise paint white
 * text on a transparent canvas with no error anywhere, and a broken export is
 * better reported than shipped.
 */
export function paint(): Paint {
  const root = getComputedStyle(document.documentElement)
  const read = (name: string): string => {
    const value = root.getPropertyValue(name).trim()
    if (value.length === 0) throw new Error(`export: --${name} is not published`)
    return value
  }
  return {
    canvas: read('--color-surface-canvas'),
    card: read('--color-surface-card'),
    textPrimary: read('--color-text-primary'),
    textLabel: read('--color-text-label'),
    textMeta: read('--color-text-meta'),
    accentText: read('--color-accent-text'),
    winner: read('--color-winner'),
    hairline: read('--color-line-hairline'),
  }
}

/** `ctx.font` for a weight and size, in the export's family. */
export function font(weight: number, px: number, family: string): string {
  return `${weight} ${px}px ${family}`
}
