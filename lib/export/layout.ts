import { captionLines } from '@/lib/media'
import { EXPORT_WIDTH } from './budget'

/**
 * Where everything goes on an exported meme, in pixels.
 *
 * Pure on purpose: the renderer hands in a `measure` function (a canvas
 * context's `measureText`, in practice) and the overlay sizes it resolved from
 * the stylesheet, and gets back a description it only has to draw. That is
 * what lets a test pin the geometry — a caption that never crosses half the
 * picture, a footer that only names an author when there is one — without a
 * canvas in the room.
 *
 * The rules restate `MediaCard.module.scss` rather than invent: the same four
 * type steps chosen by the same `captionLines`, the same insets, the same
 * half-height ceiling. What differs is deliberate and named below.
 */

/** Width of a run of text at a size and weight, as the renderer will draw it. */
export type Measure = (text: string, fontPx: number, weight: number) => number

export interface MemeSpec {
  /** Caption mode draws the lines over the picture; react mode draws the prompt above it. */
  mode: 'caption' | 'react'
  /** The source's own size. The export keeps its ratio — see `layout`. */
  media: { width: number; height: number }
  /** Caption mode's lines: top, and bottom when the room asked for two. */
  lines?: readonly (string | undefined)[]
  /** React mode's question. */
  prompt?: string
  /** Who wrote it and what it scored. Absent while the vote is anonymous. */
  author?: { name: string; points: number }
  /** Whose picture it is — `KLIPY`, `Giphy` — or nothing for the app's own art. */
  mark?: string
  roundNumber: number
}

export interface LayoutSizes {
  /** How wide to draw. `exportScale` decides it; this file only lays out. */
  width: number
  /** A caption step, resolved to pixels at that width. */
  overlayPx: (step: 1 | 2 | 3 | 4) => number
  measure: Measure
}

/** Lines of text, placed. `y` is the top of the first line. */
export interface TextBlock {
  x: number
  y: number
  width: number
  fontPx: number
  lineHeightPx: number
  weight: number
  align: 'left' | 'center' | 'right'
  lines: string[]
}

export interface Layout {
  width: number
  height: number
  /** How far the fixed parts — insets, bands — shrank for a narrow source. */
  scale: number
  /** React mode only: the prompt, in its own band above the picture. */
  header?: { y: number; h: number; text: TextBlock }
  media: { x: number; y: number; w: number; h: number }
  /** Caption mode only. Coordinates are absolute, not relative to `media`. */
  overlay: { top?: TextBlock; bottom?: TextBlock }
  footer: {
    y: number
    h: number
    fontPx: number
    /** The author's name, set brighter than the rest. */
    primary?: string
    /** `· +12 pts`, or `Captionist · round 3` when there is no author. */
    secondary: string
    /** `Powered by KLIPY`, or nothing. */
    mark?: string
    markPx: number
  }
}

/**
 * The insets and band heights at a full-width export. A narrower one scales
 * them down, but not below three quarters — a 220px GIF with a 5px footer
 * label is a file nobody can read.
 */
const SCALE_FLOOR = 0.75
const OVERLAY_INSET = 14
const OVERLAY_PAD = 10
const OVERLAY_LINE_HEIGHT = 1.1
const HEADER_PAD = 14
const HEADER_FONT = 18
const HEADER_LINE_HEIGHT = 1.3
const HEADER_MAX_LINES = 3
const FOOTER_HEIGHT = 44
const FOOTER_FONT = 13
const MARK_FONT = 11
const ELLIPSIS = '…'

export function layout(spec: MemeSpec, sizes: LayoutSizes): Layout {
  const width = Math.max(1, Math.round(sizes.width))
  const scale = Math.min(1, Math.max(SCALE_FLOOR, width / EXPORT_WIDTH))
  const px = (n: number) => Math.round(n * scale)

  // The picture at its own ratio. `mediaAspect`'s 4:5 → 4:3 band exists so a
  // vote grid reads as rows; a file has no neighbours, and cropping a 16:9
  // clip to fit a band it is not in would ship three quarters of the joke.
  const ratio =
    spec.media.width > 0 && spec.media.height > 0 ? spec.media.height / spec.media.width : 1
  const mediaH = Math.max(1, Math.round(width * ratio))

  let cursor = 0
  let header: Layout['header']
  if (spec.mode === 'react' && spec.prompt && spec.prompt.trim().length > 0) {
    const pad = px(HEADER_PAD)
    const fontPx = px(HEADER_FONT)
    const lineHeightPx = Math.round(fontPx * HEADER_LINE_HEIGHT)
    const lines = truncate(
      wrap(`“${spec.prompt.trim()}”`, width - pad * 2, fontPx, 600, sizes.measure),
      HEADER_MAX_LINES,
      width - pad * 2,
      fontPx,
      600,
      sizes.measure,
    )
    const h = pad * 2 + lines.length * lineHeightPx
    header = {
      y: 0,
      h,
      text: { x: pad, y: pad, width: width - pad * 2, fontPx, lineHeightPx, weight: 600, align: 'left', lines },
    }
    cursor = h
  }

  const media = { x: 0, y: cursor, w: width, h: mediaH }
  cursor += mediaH

  const overlay: Layout['overlay'] = {}
  if (spec.mode === 'caption') {
    const [top, bottom] = spec.lines ?? []
    const inset = px(OVERLAY_INSET)
    const pad = px(OVERLAY_PAD)
    // Neither caption may take more than half the frame — the stylesheet's
    // `max-height: calc(50% - 10px)`, which is the backstop the steps should
    // keep a caption from ever reaching.
    const ceiling = Math.floor(mediaH / 2) - pad
    const block = (text: string): Omit<TextBlock, 'x' | 'y' | 'align'> =>
      fitOverlay(text.trim().toUpperCase(), width - pad * 2, ceiling, sizes)

    if (top && top.trim()) {
      const b = block(top)
      overlay.top = { ...b, x: pad, y: media.y + inset, align: 'center' }
    }
    if (bottom && bottom.trim()) {
      const b = block(bottom)
      const blockH = b.lines.length * b.lineHeightPx
      overlay.bottom = { ...b, x: pad, y: media.y + mediaH - inset - blockH, align: 'center' }
    }
  }

  const footerH = px(FOOTER_HEIGHT)
  const footer: Layout['footer'] = {
    y: cursor,
    h: footerH,
    fontPx: px(FOOTER_FONT),
    markPx: px(MARK_FONT),
    secondary: spec.author
      ? `· +${spec.author.points} pts`
      : `Captionist · round ${spec.roundNumber}`,
    ...(spec.author ? { primary: spec.author.name } : {}),
    ...(spec.mark ? { mark: `Powered by ${spec.mark}` } : {}),
  }
  cursor += footerH

  return { width, height: cursor, scale, header, media, overlay, footer }
}

/**
 * A caption, at the largest step that keeps it inside its half of the frame.
 *
 * `captionLines` picks the step the card would have used; the real measure
 * then wraps it, and if the block still crosses the ceiling — an all-caps
 * caption of wide letters, a very short picture — it steps down once more, to
 * the fourth at most, and finally truncates. The card's own backstop is
 * `overflow: hidden`; a file cannot hide anything, so the last line ends in an
 * ellipsis instead.
 */
function fitOverlay(
  text: string,
  maxWidth: number,
  ceiling: number,
  sizes: LayoutSizes,
): Omit<TextBlock, 'x' | 'y' | 'align'> {
  let step = captionLines(text)
  for (;;) {
    const fontPx = sizes.overlayPx(step)
    const lineHeightPx = Math.round(fontPx * OVERLAY_LINE_HEIGHT)
    const lines = wrap(text, maxWidth, fontPx, 800, sizes.measure)
    if (lines.length * lineHeightPx <= ceiling || step === 4) {
      const room = Math.max(1, Math.floor(ceiling / lineHeightPx))
      return {
        width: maxWidth,
        fontPx,
        lineHeightPx,
        weight: 800,
        lines: lines.length <= room ? lines : truncate(lines, room, maxWidth, fontPx, 800, sizes.measure),
      }
    }
    step = (step + 1) as 2 | 3 | 4
  }
}

/**
 * Greedy word wrap, with the stylesheet's `overflow-wrap: anywhere` for a
 * single token wider than the box — a stack trace, a package name — which
 * breaks by character rather than running off both sides.
 */
export function wrap(
  text: string,
  maxWidth: number,
  fontPx: number,
  weight: number,
  measure: Measure,
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const lines: string[] = []
  let line = ''

  const push = (word: string) => {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate, fontPx, weight) <= maxWidth) {
      line = candidate
      return
    }
    if (line) lines.push(line)
    line = ''
    if (measure(word, fontPx, weight) <= maxWidth) {
      line = word
      return
    }
    // Break the word itself.
    let piece = ''
    for (const char of word) {
      if (measure(piece + char, fontPx, weight) <= maxWidth || piece.length === 0) {
        piece += char
      } else {
        lines.push(piece)
        piece = char
      }
    }
    line = piece
  }

  for (const word of words) push(word)
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

/** The first `max` lines, the last of them ending in an ellipsis that still fits. */
function truncate(
  lines: string[],
  max: number,
  maxWidth: number,
  fontPx: number,
  weight: number,
  measure: Measure,
): string[] {
  if (lines.length <= max) return lines
  const kept = lines.slice(0, max)
  let last = kept[max - 1] ?? ''
  while (last.length > 0 && measure(last + ELLIPSIS, fontPx, weight) > maxWidth) {
    last = last.slice(0, -1).trimEnd()
  }
  kept[max - 1] = last + ELLIPSIS
  return kept
}
