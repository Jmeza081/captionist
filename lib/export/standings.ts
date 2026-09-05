import { avatarUri } from '@/lib/avatar'
import type { FaceHat } from '@/lib/game/types'
import { hatArt } from '@/lib/hats'
import { font, fontFamily, loadFonts, paint, type Paint } from './fonts'

/**
 * The scoreboard, as a picture.
 *
 * Drawn rather than screenshotted: a DOM-to-canvas library would need the
 * page's fonts inlined, its cross-origin images proxied and its layout
 * frozen, and would still render the reaction floaters. The table is eight
 * things per row and one number per row is what people share it for.
 *
 * Avatars are the same `avatarUri` every screen draws — a data URI, so the
 * canvas stays clean — and hats are the same SVGs from `public/`, perched with
 * the same three numbers `Avatar.module.scss` uses, read back off `:root`.
 */

export interface StandingsRow {
  rank: number
  name: string
  score: number
  /** The seat colour behind the face. */
  color: string
  avatarSeed?: string
  src?: string
  hat?: FaceHat
  bot?: boolean
}

export interface StandingsSpec {
  /** `C-F34213`, for the footer. */
  code: string
  /** `Standings` between rounds; `Final standings` on the podium. */
  title: string
  rows: readonly StandingsRow[]
}

const WIDTH = 720
const PAD = 26
const HEADER_H = 88
const ROW_H = 64
const FOOTER_H = 48
const AVATAR = 40
const ART_RATIO = 0.78
const HAT_ASPECT = 44 / 31
const MAX_DPR = 2

export async function renderStandings(spec: StandingsSpec): Promise<Blob> {
  const family = fontFamily()
  await loadFonts(family)
  const colours = paint()
  const hat = hatMetrics()

  const height = HEADER_H + spec.rows.length * ROW_H + FOOTER_H
  const dpr = Math.min(MAX_DPR, Math.max(1, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1))
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('export: no 2d context')
  ctx.scale(dpr, dpr)

  // Every image first, so the draw below is synchronous and in order.
  const faces = await Promise.all(
    spec.rows.map(async (row) => ({
      art: await loadOptional(row.src ?? (row.avatarSeed ? avatarUri(row.avatarSeed, 256) : undefined)),
      brim: await loadOptional(hatArt(row.hat)),
    })),
  )

  ctx.fillStyle = colours.canvas
  ctx.fillRect(0, 0, WIDTH, height)

  // Header: the app's name, and what this is.
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = font(800, 22, family)
  ctx.fillStyle = colours.textPrimary
  ctx.fillText('Captionist', PAD, HEADER_H / 2 - 12)
  ctx.font = font(600, 13, family)
  ctx.fillStyle = colours.textLabel
  ctx.fillText(spec.title.toUpperCase(), PAD, HEADER_H / 2 + 14)

  spec.rows.forEach((row, i) => {
    const top = HEADER_H + i * ROW_H
    const middle = top + ROW_H / 2
    const face = faces[i]

    ctx.fillStyle = colours.hairline
    ctx.fillRect(PAD, top, WIDTH - PAD * 2, 1)

    ctx.textAlign = 'left'
    ctx.font = font(700, 15, family)
    ctx.fillStyle = row.rank === 1 ? colours.winner : colours.textMeta
    ctx.fillText(String(row.rank), PAD, middle)

    const ax = PAD + 34
    const ay = middle - AVATAR / 2
    drawAvatar(ctx, row, face?.art, face?.brim, ax, ay, hat, colours)

    const nameX = ax + AVATAR + 14
    const scoreX = WIDTH - PAD
    ctx.font = font(800, 17, family)
    const scoreText = `${row.score} pts`
    const scoreW = ctx.measureText(scoreText).width
    ctx.textAlign = 'right'
    ctx.fillStyle = colours.textPrimary
    ctx.fillText(scoreText, scoreX, middle)

    ctx.textAlign = 'left'
    ctx.font = font(600, 16, family)
    ctx.fillStyle = colours.textPrimary
    const nameRoom = scoreX - scoreW - 20 - nameX
    const name = ellipsise(ctx, row.name, row.bot ? nameRoom - 40 : nameRoom)
    ctx.fillText(name, nameX, middle)
    if (row.bot) {
      const w = ctx.measureText(name).width
      ctx.font = font(500, 13, family)
      ctx.fillStyle = colours.textMeta
      ctx.fillText('· bot', nameX + w + 6, middle)
    }
  })

  const footerY = HEADER_H + spec.rows.length * ROW_H
  ctx.fillStyle = colours.hairline
  ctx.fillRect(0, footerY, WIDTH, 1)
  ctx.textAlign = 'left'
  ctx.font = font(500, 12, family)
  ctx.fillStyle = colours.textMeta
  ctx.fillText(`Captionist · room ${spec.code}`, PAD, footerY + FOOTER_H / 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('export: toBlob failed'))), 'image/png')
  })
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  row: StandingsRow,
  art: HTMLImageElement | undefined,
  brim: HTMLImageElement | undefined,
  x: number,
  y: number,
  hat: { ratio: number; rise: number; tilt: number },
  colours: Paint,
): void {
  const r = AVATAR / 2
  const cx = x + r
  const cy = y + r

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = row.color
  ctx.fill()
  ctx.clip()
  if (art) {
    const size = AVATAR * ART_RATIO
    ctx.drawImage(art, cx - size / 2, cy - size / 2, size, size)
  } else {
    ctx.font = `800 ${Math.round(AVATAR * ART_RATIO * 0.44)}px ${fontFamily()}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // The player colours are mid-to-light, so the initial sits dark on them.
    ctx.fillStyle = colours.canvas
    ctx.fillText(row.name.charAt(0).toUpperCase(), cx, cy + 1)
  }
  ctx.restore()

  if (brim) {
    // `Avatar.module.scss`: the hat's box is `ratio` of the circle wide, sits
    // at `left: 50%; top: 0`, and is moved by `translate(-50%, rise)
    // rotate(tilt)` about its own bottom centre. The same transform, in
    // canvas order.
    const w = AVATAR * hat.ratio
    const h = w / HAT_ASPECT
    const ox = cx + w / 2
    const oy = y + h
    ctx.save()
    ctx.translate(ox, oy)
    ctx.translate(-w / 2, h * hat.rise)
    ctx.rotate(hat.tilt)
    ctx.translate(-ox, -oy)
    ctx.drawImage(brim, cx, y, w, h)
    ctx.restore()
  }
}

/** `--avatar-hat-*`, as numbers: a fraction, a fraction, radians. */
function hatMetrics(): { ratio: number; rise: number; tilt: number } {
  const root = getComputedStyle(document.documentElement)
  const pct = (name: string, fallback: number) => {
    const v = parseFloat(root.getPropertyValue(name))
    return Number.isFinite(v) ? v / 100 : fallback
  }
  const deg = parseFloat(root.getPropertyValue('--avatar-hat-tilt'))
  return {
    ratio: pct('--avatar-hat-ratio', 0.62),
    rise: pct('--avatar-hat-rise', -0.52),
    tilt: ((Number.isFinite(deg) ? deg : 14) * Math.PI) / 180,
  }
}

function ellipsise(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1).trimEnd()
  return `${cut}…`
}

function loadOptional(url: string | undefined): Promise<HTMLImageElement | undefined> {
  if (!url) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(undefined)
    img.src = url
  })
}
