import { describe, expect, it } from 'vitest'
import { connectRoom, transportKind } from './connect'
import { readLevers } from './levers'

const parse = (qs: string) => readLevers(new URLSearchParams(qs), true)

describe('url levers', () => {
  it('reads every lever', () => {
    expect(
      parse(
        'seed=42&bots=4&fast=10&phase=vote&mode=react&voting=single&format=one&out=1&as=p2&gifs=stub&transport=broadcast',
      ),
    ).toEqual({
      seed: 42,
      bots: 4,
      fast: 10,
      phase: 'vote',
      mode: 'react',
      voting: 'single',
      format: 'one',
      out: 1,
      as: 'p2',
      gifs: 'stub',
      transport: 'broadcast',
    })
  })

  it('ignores a voting rule or caption format that is neither', () => {
    // These two reach `fixtureFor`'s settings, so a typo must fall back to the
    // room's defaults rather than boot a room with an invalid rule.
    expect(parse('voting=freeforall').voting).toBeUndefined()
    expect(parse('format=haiku').format).toBeUndefined()
    expect(parse('voting=single').voting).toBe('single')
    expect(parse('format=one').format).toBe('one')
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

  it('takes a straggler count only as a positive whole number', () => {
    // It holds competitors back from a fixture, so a fraction or a negative
    // would silently produce a room shape the reducer cannot reach.
    expect(parse('out=2').out).toBe(2)
    expect(parse('out=0').out).toBeUndefined()
    expect(parse('out=1.5').out).toBeUndefined()
    expect(parse('out=all').out).toBeUndefined()
  })

  it('caps bots at the room ceiling', () => {
    expect(parse('bots=500').bots).toBe(19)
  })

  it('rejects nonsense without throwing', () => {
    expect(parse('bots=-2&fast=0&seed=abc&transport=carrier-pigeon')).toEqual({})
  })

  it('reads nothing at all in production', () => {
    expect(
      readLevers(
        new URLSearchParams('seed=42&bots=4&as=p2&gifs=stub&transport=broadcast'),
        false,
      ),
    ).toEqual({})
  })
})

describe('choosing a transport', () => {
  it('takes the URL lever over everything', () => {
    expect(transportKind({ transport: 'broadcast' }, false)).toBe('broadcast')
    expect(transportKind({ transport: 'ably' }, true)).toBe('ably')
  })

  it('falls to the tab transport in development when there is no key', () => {
    expect(transportKind({}, true)).toBe('broadcast')
    expect(transportKind({}, false)).toBe('ably')
  })

  it('refuses to build an Ably room it cannot authenticate', async () => {
    // Asked for Ably by a server that just said it cannot mint a token.
    // Waiting on a connection that will never authenticate looks exactly like
    // a slow one, which is the worst shape a misconfiguration can take.
    await expect(
      connectRoom({
        roomCode: 'C-F34783',
        selfId: 'u-test',
        levers: { transport: 'ably' },
        stubbed: true,
      }),
    ).rejects.toThrow(/ABLY_API_KEY/)
  })
})

describe('development guests', () => {
  it('opens none unless a count is asked for', () => {
    // `Number(null)` is 0, so a careless guard would set this lever on every
    // URL in the app that never mentioned it.
    expect(readLevers(new URLSearchParams(''))).toEqual({})
    expect(readLevers(new URLSearchParams('guests=0'))).toEqual({})
  })

  it('takes a count from the host URL', () => {
    expect(readLevers(new URLSearchParams('guests=3')).guests).toBe(3)
  })

  it('keeps the first guest in the queue distinguishable from no guest', () => {
    // Zero is a real position here — the first tab to let itself in — so
    // absence has to be tested against the parameter, not the number.
    expect(readLevers(new URLSearchParams('auto=0')).auto).toBe(0)
    expect(readLevers(new URLSearchParams('')).auto).toBeUndefined()
  })

  it('is absent in a production build, whatever the URL says', () => {
    expect(readLevers(new URLSearchParams('guests=3&auto=0'), false)).toEqual({})
  })
})
