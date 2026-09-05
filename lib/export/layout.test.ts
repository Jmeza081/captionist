import { describe, expect, it } from 'vitest'
import { layout, wrap, type LayoutSizes, type MemeSpec } from './layout'

/**
 * A monospace world: every glyph is 0.6em wide, whatever the weight. Real
 * measuring is the renderer's; these pin the geometry the rules produce.
 */
const measure = (text: string, fontPx: number) => text.length * fontPx * 0.6
const steps = { 1: 38, 2: 29, 3: 23, 4: 19 } as const
const sizes: LayoutSizes = { width: 480, overlayPx: (step) => steps[step], measure }

const caption = (over: Partial<MemeSpec> = {}): MemeSpec => ({
  mode: 'caption',
  media: { width: 480, height: 360 },
  lines: ['Ship it', 'Rollback'],
  author: { name: 'Priya', points: 3 },
  mark: 'KLIPY',
  roundNumber: 3,
  ...over,
})

describe('layout', () => {
  it('keeps the picture at its own ratio and draws nothing above it in caption mode', () => {
    const l = layout(caption({ media: { width: 1920, height: 1080 } }), sizes)
    expect(l.header).toBeUndefined()
    expect(l.media).toEqual({ x: 0, y: 0, w: 480, h: 270 })
    expect(l.footer.y).toBe(270)
    expect(l.height).toBe(270 + l.footer.h)
  })

  it('sets the caption in capitals at the card’s own step, top and bottom', () => {
    const l = layout(caption(), sizes)
    expect(l.overlay.top?.lines).toEqual(['SHIP IT'])
    expect(l.overlay.top?.fontPx).toBe(steps[1])
    expect(l.overlay.top?.y).toBe(14)
    expect(l.overlay.bottom?.lines).toEqual(['ROLLBACK'])
    const bottom = l.overlay.bottom
    expect(bottom && bottom.y + bottom.lineHeightPx).toBe(360 - 14)
  })

  it('draws only the top line for a one-line room', () => {
    const l = layout(caption({ lines: ['Ship it'] }), sizes)
    expect(l.overlay.top).toBeDefined()
    expect(l.overlay.bottom).toBeUndefined()
  })

  it('never lets a caption cross half the picture, stepping down before it truncates', () => {
    const long = 'a very long caption that goes on and on about the deploy'
    for (const height of [360, 200, 150]) {
      const l = layout(caption({ media: { width: 480, height }, lines: [long] }), sizes)
      const top = l.overlay.top
      expect(top).toBeDefined()
      const blockH = (top?.lines.length ?? 0) * (top?.lineHeightPx ?? 0)
      expect(blockH).toBeLessThanOrEqual(Math.floor(height / 2) - 10)
      // The card's own step for 56 characters is the third; never larger.
      expect(top?.fontPx).toBeLessThanOrEqual(steps[3])
      expect(top?.lines.at(-1)?.endsWith('…')).toBe(false)
    }
  })

  it('truncates with an ellipsis when even the smallest step will not fit', () => {
    // A letterbox no real card has, to reach the backstop.
    const long = 'a very long caption that goes on and on about the deploy'.repeat(2)
    const l = layout(caption({ media: { width: 480, height: 120 }, lines: [long] }), sizes)
    const top = l.overlay.top
    const blockH = (top?.lines.length ?? 0) * (top?.lineHeightPx ?? 0)
    expect(blockH).toBeLessThanOrEqual(60 - 10)
    expect(top?.lines.at(-1)?.endsWith('…')).toBe(true)
  })

  it('puts the prompt in a band above the picture in react mode', () => {
    const l = layout(
      caption({ mode: 'react', lines: undefined, prompt: 'When the deploy is on a Friday' }),
      sizes,
    )
    expect(l.header).toBeDefined()
    expect(l.header?.text.lines[0]?.startsWith('“')).toBe(true)
    expect(l.media.y).toBe(l.header?.h)
    expect(l.overlay).toEqual({})
  })

  it('caps the prompt at three lines', () => {
    const l = layout(
      caption({ mode: 'react', lines: undefined, prompt: 'word '.repeat(80) }),
      sizes,
    )
    expect(l.header?.text.lines).toHaveLength(3)
    expect(l.header?.text.lines[2]?.endsWith('…')).toBe(true)
  })

  it('names the author and the points on the reveal', () => {
    const l = layout(caption(), sizes)
    expect(l.footer.primary).toBe('Priya')
    expect(l.footer.secondary).toBe('· +3 pts')
    expect(l.footer.mark).toBe('Powered by KLIPY')
  })

  it('names the round instead of an author during the vote', () => {
    const l = layout(caption({ author: undefined }), sizes)
    expect(l.footer.primary).toBeUndefined()
    expect(l.footer.secondary).toBe('Captionist · round 3')
  })

  it('credits nobody for the app’s own art', () => {
    const l = layout(caption({ mark: undefined }), sizes)
    expect(l.footer.mark).toBeUndefined()
  })

  it('shrinks the fixed parts for a narrow source, but not past three quarters', () => {
    const l = layout(caption({ media: { width: 240, height: 240 } }), { ...sizes, width: 240 })
    expect(l.scale).toBe(0.75)
    expect(l.footer.h).toBe(33)
  })
})

describe('wrap', () => {
  it('breaks on spaces while a line fits', () => {
    expect(wrap('one two three four', 10 * 6, 10, 800, measure)).toEqual(['one two', 'three four'])
  })

  it('breaks a token wider than the box by character', () => {
    const token = 'x'.repeat(60)
    const lines = wrap(token, 10 * 6, 10, 800, measure)
    expect(lines).toHaveLength(6)
    expect(lines.join('')).toBe(token)
  })

  it('returns one empty line for nothing', () => {
    expect(wrap('   ', 100, 10, 800, measure)).toEqual([''])
  })
})
