import { describe, expect, it } from 'vitest'
import { readLevers } from './levers'

const parse = (qs: string) => readLevers(new URLSearchParams(qs), true)

describe('url levers', () => {
  it('reads every lever', () => {
    expect(parse('seed=42&bots=4&fast=10&phase=vote&mode=react&as=p2&gifs=stub')).toEqual({
      seed: 42,
      bots: 4,
      fast: 10,
      phase: 'vote',
      mode: 'react',
      as: 'p2',
      gifs: 'stub',
    })
  })

  it('ignores a mode that is not a mode', () => {
    expect(parse('mode=sideways').mode).toBeUndefined()
  })

  it('only accepts a seat id shaped like one', () => {
    expect(parse('as=p12').as).toBe('p12')
    expect(parse('as=; drop table').as).toBeUndefined()
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
    expect(
      readLevers(new URLSearchParams('seed=42&bots=4&as=p2&gifs=stub'), false),
    ).toEqual({})
  })
})
