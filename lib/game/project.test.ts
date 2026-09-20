import { describe, expect, it } from 'vitest'
import { fixtureFor } from './fixtures'
import { project } from './project'
import { reduce } from './reducer'
import { ballotFrom } from './selectors'
import type { GameState, PlayerId } from './types'

/**
 * The `vote` and `tiebreak` fixtures open their phase rather than play it, so
 * a ballot box is empty in both. These fill one, because a redaction test that
 * runs against nothing passes for the wrong reason.
 */
function withBallots(state: GameState): GameState {
  const entries = state.round?.entries ?? []
  let next = state
  for (const player of state.players) {
    const own = entries.find((e) => e.authorId === player.id)
    const ranked = entries.map((e) => e.id).filter((id) => id !== own?.id).slice(0, 3)
    const ballot = ballotFrom(next, ranked)
    if (!ballot) continue
    const after = reduce(next, {
      type: 'round/ballotCast',
      ballot,
      at: Date.now(),
      actor: player.id,
    })
    // The last ballot closes the vote. Stop before the phase moves on.
    if (after.phase !== state.phase) break
    next = after
  }
  return next
}

function withDuelVotes(state: GameState): GameState {
  const [first] = state.round?.tiebreak?.contenders ?? []
  if (first === undefined) return state
  let next = state
  for (const player of state.players) {
    const after = reduce(next, {
      type: 'round/tiebreakVoted',
      choice: first,
      at: Date.now(),
      actor: player.id,
    })
    if (after.phase !== state.phase) break
    next = after
  }
  return next
}

const voters = (state: GameState): PlayerId[] => Object.keys(state.round?.ballots ?? {})

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
    const seen = project(state, 'p1')
    const authors = seen.round?.entries.map((e) => e.authorId) ?? []
    expect(authors.length).toBeGreaterThan(1)
    expect(authors.every((a) => a !== undefined)).toBe(true)
  })
})

/**
 * A ballot rides a different schedule from authorship: authorship is public
 * from the reveal, a ballot is never public.
 *
 * The bug these lock down was not a missing redaction but a missing *join*.
 * Both halves are individually harmless — during the vote the ballots name
 * entries whose authors are stripped, and at the reveal the authors are meant
 * to be back — and the leak is the two of them in one object.
 */
describe('a ballot', () => {
  // Every phase a round survives, with a filled ballot box in each. `reveal`
  // and `score` are the dangerous ones: authorship is back, and `Round` is not
  // replaced until `round/advanced` calls `beginRound()`.
  const cases: Record<string, () => GameState> = {
    vote: () => withBallots(fixtureFor('vote', { players: 5 })),
    tiebreak: () => fixtureFor('tiebreak', { players: 5 }),
    reveal: () => fixtureFor('reveal', { players: 5 }),
    score: () => fixtureFor('score', { players: 5 }),
  }

  for (const [phase, build] of Object.entries(cases)) {
    it(`is the viewer's own or nobody's, at ${phase}`, () => {
      const state = build()
      // Somebody other than the viewer has to have voted, or this passes for
      // the wrong reason.
      expect(voters(state).filter((id) => id !== 'p1').length).toBeGreaterThan(0)

      const seen = project(state, 'p1')
      expect(voters(seen as GameState)).toEqual(voters(state).includes('p1') ? ['p1'] : [])
    })
  }

  it('leaves the viewer their own ballot, which the vote grid needs', () => {
    const state = fixtureFor('reveal', { players: 5 })
    const mine = state.round?.ballots['p1']
    expect(mine).toBeDefined()
    expect(project(state, 'p1').round?.ballots['p1']).toEqual(mine)
  })

  it('does not survive the join that made it a leak', () => {
    // The whole defect in one assertion: at the reveal, authorship is public
    // by design. If a ballot were public too, pairing them would name who
    // ranked whom.
    const state = fixtureFor('reveal', { players: 5 })
    const seen = project(state, 'p1')

    const authored = (seen.round?.entries ?? []).filter((e) => e.authorId !== undefined)
    expect(authored.length).toBeGreaterThan(1)

    const others = Object.keys(seen.round?.ballots ?? {}).filter((id) => id !== 'p1')
    expect(others).toEqual([])
  })
})

/**
 * The duel is the one screen that names people before the reveal, which is
 * exactly why its votes need no join to identify anybody.
 */
describe('a tiebreak vote', () => {
  it('keeps who has voted, so the count stays honest', () => {
    const state = withDuelVotes(fixtureFor('tiebreak', { players: 5 }))
    const before = Object.keys(state.round?.tiebreak?.votes ?? {})
    expect(before.length).toBeGreaterThan(0)

    // `tiebreakCopy` renders "4 of 7 have voted" off these keys.
    const seen = project(state, 'p1')
    expect(Object.keys(seen.round?.tiebreak?.votes ?? {}).sort()).toEqual([...before].sort())
  })

  it('does not keep what anybody but the viewer chose', () => {
    const state = withDuelVotes(fixtureFor('tiebreak', { players: 5 }))
    const votes = project(state, 'p1').round?.tiebreak?.votes ?? {}
    expect(Object.keys(votes).filter((id) => id !== 'p1').length).toBeGreaterThan(0)

    for (const [voter, choice] of Object.entries(votes)) {
      if (voter === 'p1') continue
      // An empty id: this seat voted, and you may not see for whom.
      expect(choice).toBe('')
    }
  })

  it('leaves the viewer their own choice, which the screen marks', () => {
    const state = withDuelVotes(fixtureFor('tiebreak', { players: 5 }))
    const mine = state.round?.tiebreak?.votes['p1']
    // Only meaningful if this fixture's viewer actually voted.
    if (mine === undefined) return
    expect(project(state, 'p1').round?.tiebreak?.votes['p1']).toBe(mine)
  })
})
