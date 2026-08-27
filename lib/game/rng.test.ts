import { describe, expect, it } from 'vitest'
import { generateCode, normalizeCode } from './codes'
import { nextInt, pick, shuffle } from './rng'

describe('the seeded PRNG', () => {
  it('gives the same shuffle for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f']
    const [first] = shuffle(items, 42)
    const [second] = shuffle(items, 42)
    expect(first).toEqual(second)
  })

  it('gives a different shuffle for a different seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const [a] = shuffle(items, 1)
    const [b] = shuffle(items, 2)
    expect(a).not.toEqual(b)
  })

  it('keeps every item and never mutates the input', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const frozen = Object.freeze(items.slice())
    const [out] = shuffle(frozen, 7)
    expect([...out].sort()).toEqual([...items].sort())
    expect(frozen).toEqual(items)
  })

  it('advances the cursor, so consecutive draws differ', () => {
    const [, seedA] = nextInt(42, 100)
    const [, seedB] = nextInt(seedA, 100)
    expect(seedA).not.toBe(seedB)
  })

  it('handles the empty and single-item cases', () => {
    expect(shuffle([], 42)[0]).toEqual([])
    expect(shuffle(['only'], 42)[0]).toEqual(['only'])
    expect(pick([], 42)[0]).toBeUndefined()
  })

  it('stays within bounds across many draws', () => {
    let seed = 3
    for (let i = 0; i < 500; i++) {
      const [value, next] = nextInt(seed, 7)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(7)
      seed = next
    }
  })
})

describe('room codes', () => {
  it('generates a code in the documented shape', () => {
    const [code] = generateCode(42)
    expect(code).toMatch(/^C-[346789A-HJ-NP-RT-Y]{6}$/)
  })

  it('is reproducible from the seed', () => {
    expect(generateCode(42)[0]).toBe(generateCode(42)[0])
  })

  it('never emits a character that is misread when read aloud', () => {
    let seed = 1
    for (let i = 0; i < 200; i++) {
      const [code, next] = generateCode(seed)
      expect(code).not.toMatch(/[ILOSZ012]/)
      seed = next
    }
  })

  it('accepts what a person actually types', () => {
    const [code] = generateCode(42)
    const body = code.slice(2)
    expect(normalizeCode(code)).toBe(code)
    expect(normalizeCode(code.toLowerCase())).toBe(code)
    expect(normalizeCode(body)).toBe(code)
    expect(normalizeCode(` ${body.slice(0, 3)} ${body.slice(3)} `)).toBe(code)
  })

  it('maps the ambiguous characters onto their intended twin', () => {
    expect(normalizeCode('C-ABCDEF')).toBe('C-ABCDEF')
    // I and L read as J, O reads as Q, S as 3, Z as 4.
    expect(normalizeCode('C-IOSZAB')).toBe('C-JQ34AB')
  })

  it('rejects a code that is the wrong length or has no chance of being real', () => {
    expect(normalizeCode('C-ABC')).toBeNull()
    expect(normalizeCode('')).toBeNull()
    expect(normalizeCode('C-ABCDEFGH')).toBeNull()
  })
})
