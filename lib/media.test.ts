import { describe, expect, it } from 'vitest'
import {
  CHARS_PER_LINE,
  MEDIA_ASPECT_MAX,
  MEDIA_ASPECT_MIN,
  captionLines,
  hasImage,
  imageSrc,
  mediaAspect,
} from './media'

/**
 * The shape a card is drawn at.
 *
 * The band is the whole point: unclamped, one 9:16 tile beside one 16:9 tile
 * is a 3× spread in height and a vote grid stops reading as a grid. These pin
 * both ends of it and the pass-through in the middle.
 */
describe('mediaAspect', () => {
  it('passes a ratio inside the band through untouched', () => {
    expect(mediaAspect({ width: 100, height: 100 })).toBe(1)
    // 6:5 — inside the band, so it is drawn exactly as it came.
    expect(mediaAspect({ width: 300, height: 250 })).toBeCloseTo(1.2, 5)
  })

  it('clamps a wide source to the top of the band rather than to a square', () => {
    // 16:9 is 1.78. Squared off it showed 56% of the frame; at 4:3 it shows
    // three quarters.
    expect(mediaAspect({ width: 1920, height: 1080 })).toBe(MEDIA_ASPECT_MAX)
    expect(mediaAspect({ width: 320, height: 200 })).toBe(MEDIA_ASPECT_MAX)
  })

  it('clamps a tall source to the bottom of the band rather than to a column', () => {
    expect(mediaAspect({ width: 1080, height: 1920 })).toBe(MEDIA_ASPECT_MIN)
  })

  /**
   * `undefined`, never a default. The fallback belongs to the stylesheet — a
   * number here would be a second place that could disagree with it.
   */
  it('reports nothing when the source never said', () => {
    expect(mediaAspect(undefined)).toBeUndefined()
    expect(mediaAspect({})).toBeUndefined()
    expect(mediaAspect({ width: 640 })).toBeUndefined()
    expect(mediaAspect({ height: 360 })).toBeUndefined()
  })

  it('reports nothing for a size that cannot be a ratio', () => {
    expect(mediaAspect({ width: 0, height: 100 })).toBeUndefined()
    expect(mediaAspect({ width: -640, height: 360 })).toBeUndefined()
  })
})

describe('imageSrc', () => {
  it('hands a blank pixel to an image with nothing to show', () => {
    // An empty `src` makes the browser refetch the page and fire a spurious
    // error — see DESIGNSYSTEM §5.
    expect(imageSrc('')).toMatch(/^data:image\/gif/)
    expect(imageSrc(undefined)).toMatch(/^data:image\/gif/)
    expect(imageSrc('/media/stub-retro.svg')).toBe('/media/stub-retro.svg')
  })

  it('tells a real image from a placeholder standing in for one', () => {
    expect(hasImage('/media/stub-retro.svg')).toBe(true)
    expect(hasImage('')).toBe(false)
    expect(hasImage(undefined)).toBe(false)
  })
})

/**
 * The step a caption is set at, from its length alone.
 *
 * The boundaries are what matter: a caption exactly one line long keeps the
 * poster size, one character more drops a step, and nothing ever goes past the
 * fourth — which is where `CAPTION_MAX` lands.
 */
describe('captionLines', () => {
  const of = (n: number) => 'x'.repeat(n)

  it('holds one line up to the line length and steps down one character later', () => {
    expect(captionLines('')).toBe(1)
    expect(captionLines(of(CHARS_PER_LINE))).toBe(1)
    expect(captionLines(of(CHARS_PER_LINE + 1))).toBe(2)
    expect(captionLines(of(CHARS_PER_LINE * 2))).toBe(2)
    expect(captionLines(of(CHARS_PER_LINE * 2 + 1))).toBe(3)
    expect(captionLines(of(CHARS_PER_LINE * 3))).toBe(3)
    expect(captionLines(of(CHARS_PER_LINE * 3 + 1))).toBe(4)
  })

  it('never goes past the fourth step', () => {
    expect(captionLines(of(CHARS_PER_LINE * 9))).toBe(4)
  })

  it('does not count the whitespace around a caption', () => {
    expect(captionLines(`   ${of(CHARS_PER_LINE)}   `)).toBe(1)
  })
})
