import { describe, expect, it } from 'vitest'
import { readLevers } from './levers'

const parse = (qs: string) => readLevers(new URLSearchParams(qs), true)

describe('url levers', () => {
  it('reads all four', () => {
    expect(parse('seed=42&bots=4&fast=10&phase=vote')).toEqual({
      seed: 42,
      bots: 4,
      fast: 10,
      phase: 'vote',
    })
  })

  it('ignores a phase that has no fixture', () => {
    expect(parse('phase=nonsense').phase).toBeUndefined()
  })

  it('caps bots at the room ceiling', () => {
    expect(parse('bots=500').bots).toBe(19)
  })

  it('rejects nonsense without throwing', () => {
    expect(parse('bots=-2&fast=0&seed=abc')).toEqual({})
  })

  it('reads nothing at all in production', () => {
    expect(readLevers(new URLSearchParams('seed=42&bots=4'), false)).toEqual({})
  })
})
