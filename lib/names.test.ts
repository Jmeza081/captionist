import { describe, expect, it } from 'vitest'
import { NAME_MAX, NAME_PARTS, suggestName } from './names'

describe('suggestName', () => {
  it('is an adjective and a noun, joined', () => {
    expect(suggestName(() => 0)).toMatch(/^[A-Z][a-z]+_[A-Z][a-z]+$/)
  })

  it('draws both halves from the given random source', () => {
    // Two calls, so the sequence has to be walked rather than one number reused.
    const draws = [0, 0.999]
    let i = 0
    const name = suggestName(() => draws[i++] ?? 0)
    const { adjectives, nouns } = NAME_PARTS
    expect(name).toBe(`${adjectives[0]}_${nouns[nouns.length - 1]}`)
  })

  /**
   * The nickname field is capped at 20 characters, and a suggestion that
   * arrived already truncated would be a name nobody chose. Every pair, not a
   * sample: the lists are short enough to check exhaustively and long enough
   * that adding one long word by hand would otherwise slip through.
   */
  it('never suggests a name the nickname field would truncate', () => {
    for (const adjective of NAME_PARTS.adjectives) {
      for (const noun of NAME_PARTS.nouns) {
        expect(`${adjective}_${noun}`.length).toBeLessThanOrEqual(NAME_MAX)
      }
    }
  })

  it('has no duplicates in either half', () => {
    expect(new Set(NAME_PARTS.adjectives).size).toBe(NAME_PARTS.adjectives.length)
    expect(new Set(NAME_PARTS.nouns).size).toBe(NAME_PARTS.nouns.length)
  })
})
