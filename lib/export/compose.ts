import { font, type Paint } from './fonts'
import type { Layout, TextBlock } from './layout'

/**
 * One frame of the meme, drawn.
 *
 * Everything positional comes from `layout()`; this only paints. Called once
 * per source frame with the same `Layout`, so nothing here may keep state
 * between calls, and nothing here measures — the wrap was decided already.
 *
 * What it restates from `MediaCard.module.scss`, and one thing it cannot: a
 * canvas has no `text-shadow`, so the overlay's four-way black shadow is four
 * black fills a shadow's width off, then the white on top. It reads the same.
 */

const OVERLAY_SHADOW = 2
const FOOTER_PAD = 14
/** The overlay's `letter-spacing: -0.01em`. Applied to the 800 weight only. */
export const OVERLAY_TRACKING = '-0.01em'

/**
 * Tracking is a property of the overlay's weight, so `measure` and the paint
 * below can agree without a second parameter threading through `layout()`.
 */
export function applyTracking(ctx: CanvasRenderingContext2D, weight: number): void {
  if ('letterSpacing' in ctx) ctx.letterSpacing = weight === 800 ? OVERLAY_TRACKING : '0px'
}

export function composeFrame(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  layout: Layout,
  paint: Paint,
  family: string,
): void {
  const { width, height, media, footer, header, overlay, scale } = layout

  ctx.save()
  ctx.fillStyle = paint.canvas
  ctx.fillRect(0, 0, width, height)

  if (header) {
    ctx.fillStyle = paint.card
    ctx.fillRect(0, header.y, width, header.h)
    drawBlock(ctx, header.text, family, paint.textPrimary)
  }

  ctx.drawImage(image, media.x, media.y, media.w, media.h)

  const shadow = Math.max(1, Math.round(OVERLAY_SHADOW * scale))
  if (overlay.top) drawOverlay(ctx, overlay.top, family, paint.textPrimary, shadow)
  if (overlay.bottom) drawOverlay(ctx, overlay.bottom, family, paint.textPrimary, shadow)

  ctx.fillStyle = paint.canvas
  ctx.fillRect(0, footer.y, width, footer.h)
  ctx.fillStyle = paint.hairline
  ctx.fillRect(0, footer.y, width, 1)

  const pad = Math.round(FOOTER_PAD * scale)
  const middle = footer.y + footer.h / 2
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  applyTracking(ctx, 600)
  let x = pad
  if (footer.primary) {
    ctx.font = font(600, footer.fontPx, family)
    ctx.fillStyle = paint.textPrimary
    ctx.fillText(footer.primary, x, middle)
    x += ctx.measureText(footer.primary).width + Math.round(6 * scale)
  }
  ctx.font = font(500, footer.fontPx, family)
  ctx.fillStyle = paint.textMeta
  ctx.fillText(footer.secondary, x, middle)

  if (footer.mark) {
    ctx.textAlign = 'right'
    ctx.font = font(600, footer.markPx, family)
    ctx.fillStyle = paint.textMeta
    ctx.fillText(footer.mark, width - pad, middle)
  }
  ctx.restore()
}

function drawBlock(ctx: CanvasRenderingContext2D, block: TextBlock, family: string, color: string): void {
  ctx.font = font(block.weight, block.fontPx, family)
  applyTracking(ctx, block.weight)
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.textAlign = block.align
  const x = block.align === 'center' ? block.x + block.width / 2 : block.align === 'right' ? block.x + block.width : block.x
  block.lines.forEach((line, i) => {
    ctx.fillText(line, x, block.y + i * block.lineHeightPx)
  })
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  block: TextBlock,
  family: string,
  color: string,
  shadow: number,
): void {
  ctx.font = font(block.weight, block.fontPx, family)
  applyTracking(ctx, block.weight)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  const x = block.x + block.width / 2
  block.lines.forEach((line, i) => {
    const y = block.y + i * block.lineHeightPx
    ctx.fillStyle = '#000'
    ctx.fillText(line, x + shadow, y)
    ctx.fillText(line, x - shadow, y)
    ctx.fillText(line, x, y + shadow)
    ctx.fillText(line, x, y - shadow)
    ctx.fillStyle = color
    ctx.fillText(line, x, y)
  })
}
