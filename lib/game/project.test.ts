import { describe, expect, it } from 'vitest'
import { fixtureFor } from './fixtures'
import { project } from './project'

/**
 * Anonymity is redaction, not restraint: host authority means every client
 * holds the whole room, so what does not go on the wire is the only thing that
 * is actually hidden.
 */
describe('what goes on the wire', () => {
  it('strips every author but the viewer’s own while voting is open', () => {
    const state = fixtureFor('vote', { players: 5 })
    const seen = project(state, 'p1')
    const authors = seen.round?.entries.map((e) => e.authorId) ?? []
    expect(authors).toContain('p1')
    expect(authors.filter((a) => a !== undefined)).toEqual(['p1'])
  })

  it('does not hand authorship back through the tiebreak’s pending result', () => {
    // `RoundResult.authorOf` maps *every* entry to its author. Leaving it whole
    // would undo the redaction above by a second route.
    const state = fixtureFor('tiebreak', { players: 5 })
    const contenders = state.round?.tiebreak?.contenders ?? []
    expect(contenders.length).toBeGreaterThan(1)

    const seen = project(state, 'p1')
    const authorOf = seen.round?.tiebreak?.pending.authorOf ?? {}
    expect(Object.keys(authorOf).sort()).toEqual([...contenders].sort())
    // The duel still names its two players — that is the screen's whole job.
    for (const id of contenders) expect(authorOf[id]).toBeTruthy()
  })

  it('gives authorship back at the reveal', () => {
    const state = fixtureFor('reveal', { players: 5 })
    expect(project(state, 'p1')).toBe(state)
  })
})
