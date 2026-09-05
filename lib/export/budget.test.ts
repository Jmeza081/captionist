import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DELAY_MS,
  EXPORT_WIDTH,
  MAX_FRAMES,
  MIN_DELAY_MS,
  budgetFrames,
  exportScale,
  normaliseDelay,
} from './budget'

describe('normaliseDelay', () => {
  it('plays a missing or zero delay at the browsers’ hundred', () => {
    expect(normaliseDelay(undefined)).toBe(DEFAULT_DELAY_MS)
    expect(normaliseDelay(0)).toBe(DEFAULT_DELAY_MS)
    expect(normaliseDelay(-5)).toBe(DEFAULT_DELAY_MS)
  })

  it('floors a delay no player would honour', () => {
    expect(normaliseDelay(10)).toBe(MIN_DELAY_MS)
    expect(normaliseDelay(20)).toBe(20)
    expect(normaliseDelay(70)).toBe(70)
  })
})

describe('exportScale', () => {
  it('shrinks a wide source to the export width at its own ratio', () => {
    expect(exportScale(1920, 1080)).toEqual({ scale: 0.25, width: 480, height: 270 })
  })

  it('never upscales a small one', () => {
    expect(exportScale(320, 200)).toEqual({ scale: 1, width: 320, height: 200 })
    expect(exportScale(EXPORT_WIDTH, 500)).toEqual({ scale: 1, width: 480, height: 500 })
  })

  it('survives a source that never said', () => {
    expect(exportScale(0, 0).width).toBeGreaterThan(0)
  })
})

describe('budgetFrames', () => {
  const frames = (n: number, delay = 40) =>
    Array.from({ length: n }, (_, i) => ({ id: i, delay }))

  it('leaves a short animation alone', () => {
    const kept = budgetFrames(frames(30))
    expect(kept).toHaveLength(30)
    expect(kept.map((f) => f.id)).toEqual(frames(30).map((f) => f.id))
  })

  it('drops every Nth frame and keeps the running time', () => {
    const source = frames(250)
    const kept = budgetFrames(source)
    expect(kept.length).toBeLessThanOrEqual(MAX_FRAMES)
    // Stride 3: frames 0, 3, 6 … survive.
    expect(kept.slice(0, 3).map((f) => f.id)).toEqual([0, 3, 6])
    const before = source.reduce((sum, f) => sum + f.delay, 0)
    const after = kept.reduce((sum, f) => sum + f.delay, 0)
    expect(after).toBe(before)
  })

  it('counts a dropped zero-delay frame as the hundred it would have played for', () => {
    const kept = budgetFrames(frames(200, 0))
    const after = kept.reduce((sum, f) => sum + f.delay, 0)
    expect(after).toBe(200 * DEFAULT_DELAY_MS)
  })
})
