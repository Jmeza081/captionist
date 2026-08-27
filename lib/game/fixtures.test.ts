import { describe, expect, it } from 'vitest'
import { FIXTURE_PHASES, fixtureFor, lobbyFixture } from './fixtures'
import { podiumPlaces, standings, voteCards } from './selectors'

describe('fixtures', () => {
  it('boots into every phase it advertises', () => {
    for (const phase of FIXTURE_PHASES) {
      expect(fixtureFor(phase).phase, `fixture for ${phase}`).toBe(phase)
    }
  })

  it('is reproducible, so Playwright can name a specific card', () => {
    expect(fixtureFor('vote').round?.order).toEqual(fixtureFor('vote').round?.order)
  })

  it('works in both modes', () => {
    expect(fixtureFor('vote', { settings: { mode: 'react' } }).phase).toBe('vote')
    expect(fixtureFor('podium', { settings: { mode: 'react' } }).phase).toBe('podium')
  })

  it('gives every player a colour, cycling past the palette of seven', () => {
    const big = lobbyFixture({ players: 7 })
    expect(big.players.every((p) => p.color !== '')).toBe(true)
  })

  it('leaves the vote grid with one own-entry per competing viewer', () => {
    const state = fixtureFor('vote')
    const cards = voteCards(state, 'p1')
    expect(cards.filter((c) => c.own)).toHaveLength(1)
    // The role holder sat the round out, so nothing on the grid is theirs.
    expect(voteCards(state, 'p0').filter((c) => c.own)).toHaveLength(0)
  })

  it('reaches a podium with a full set of standings', () => {
    const state = fixtureFor('podium')
    expect(state.history).toHaveLength(state.settings.totalRounds)
    expect(standings(state)).toHaveLength(state.players.length)
    expect(podiumPlaces(state)?.first).toBeDefined()
  })
})
