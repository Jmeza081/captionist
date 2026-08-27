import { describe, expect, it } from 'vitest'
import type { ActionInput, GameAction } from './actions'
import { authorize } from './authorize'
import { MIN_PLAYERS, PLAYER_COLORS, colorFor } from './constants'
import { createRoom } from './create'
import { project } from './project'
import { reduce } from './reducer'
import { scoresFrom, standings, submittedCount, viewKey } from './selectors'
import type { EntryAnswer, GameState, PlayerId } from './types'

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

let clock = 1_000

function at(): number {
  clock += 10
  return clock
}

/** Applies an action the way the host engine does: authorize, then reduce. */
function apply(state: GameState, actor: PlayerId, action: ActionInput): GameState {
  const full = { ...action, at: at(), actor } as GameAction
  const verdict = authorize(state, full)
  if (verdict !== true) throw new Error(`${action.type} rejected: ${verdict}`)
  return reduce(state, full)
}

/** Fires the current phase's clock. */
function expire(state: GameState): GameState {
  return reduce(state, { type: 'clock/expired', phase: state.phase, at: at(), actor: 'system' })
}

function room(playerCount: number, settings?: Parameters<typeof createRoom>[0]['settings']) {
  let state = createRoom({
    roomCode: 'C-F34213',
    host: { id: 'p0', name: 'Jesse', avatarSeed: 'jesse' },
    settings,
    seed: 42,
    at: at(),
  })
  for (let i = 1; i < playerCount; i++) {
    state = apply(state, `p${i}`, {
      type: 'player/joined',
      player: { id: `p${i}`, name: `Player ${i}`, avatarSeed: `p${i}` },
    })
  }
  return state
}

const caption = (text: string): EntryAnswer => ({ kind: 'caption', lines: [text] })

/** Everyone who is competing submits. */
function submitAll(state: GameState): GameState {
  for (const p of state.players) {
    if (state.round?.roleHolderId === p.id) continue
    state = apply(state, p.id, { type: 'round/entrySubmitted', answer: caption(`${p.id} says`) })
  }
  return state
}

/**
 * Everyone votes, ranking whatever they did not author in the round's own
 * order. Reads the live state each time — a closure over the caller's `state`
 * would be one round stale.
 */
function voteAll(state: GameState): GameState {
  for (const p of state.players) {
    const own = state.round?.entries.find((e) => e.authorId === p.id)
    const ranked = (state.round?.entries ?? [])
      .map((e) => e.id)
      .filter((id) => id !== own?.id)
      .slice(0, 3)
    if (ranked.length === 0) continue
    state = apply(state, p.id, { type: 'round/ballotCast', ballot: { kind: 'rank', ranked } })
  }
  return state
}

/** Drives one round from the opener through to the reveal. */
function playRound(state: GameState): GameState {
  expectPhase(state, 'opener')
  state = expire(state) // opener -> brief
  state = apply(state, state.round?.roleHolderId ?? 'p0', {
    type: 'round/subjectLocked',
    subject: { kind: 'media', media: { src: 'g.gif', alt: 'a gif', source: 'giphy' } },
  })
  expectPhase(state, 'compose')
  state = submitAll(state)
  expectPhase(state, 'waiting')
  state = expire(state) // waiting -> vote
  expectPhase(state, 'vote')
  return voteAll(state)
}

function expectPhase(state: GameState, phase: GameState['phase']) {
  expect(state.phase).toBe(phase)
}

/* ------------------------------------------------------------------ */

describe('room setup', () => {
  it('needs three players to start', () => {
    const small = room(2)
    const verdict = authorize(small, { type: 'game/started', at: at(), actor: 'p0' })
    expect(verdict).toBe('Need 1 more player.')

    const enough = room(MIN_PLAYERS)
    expect(authorize(enough, { type: 'game/started', at: at(), actor: 'p0' })).toBe(true)
  })

  it('only the host can start', () => {
    const state = room(4)
    expect(authorize(state, { type: 'game/started', at: at(), actor: 'p2' })).toBe(
      'Only the host can do that.',
    )
  })

  it('rejects a duplicate nickname when the room asks for unique ones', () => {
    const state = room(2)
    expect(
      authorize(state, {
        type: 'player/joined',
        player: { id: 'pX', name: 'jesse', avatarSeed: 'x' },
        at: at(),
        actor: 'pX',
      }),
    ).toBe('Someone already has that name. Pick another.')
  })
})

describe('the role holder sets up and sits out', () => {
  it('is not counted as a competitor and cannot submit', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state) // opener -> brief
    const holder = state.round?.roleHolderId ?? ''
    expect(holder).toBe('p0')
    state = apply(state, holder, {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'x' },
    })
    expectPhase(state, 'compose')

    expect(
      authorize(state, {
        type: 'round/entrySubmitted',
        answer: caption('nope'),
        at: at(),
        actor: holder,
      }),
    ).toBe('You set this round up, so you sit it out.')

    expect(submittedCount(state)).toEqual({ done: 0, total: 3 })
  })

  it('advances to waiting once every competitor has submitted', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state)
    state = apply(state, 'p0', {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'Prod is fine.' },
    })
    expectPhase(state, 'compose')
    state = submitAll(state)
    expect(state.round?.entries).toHaveLength(3)
    expectPhase(state, 'waiting')
  })

  it('rotates each round', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    expect(state.round?.roleHolderId).toBe('p0')
    state = playRound(state)
    expectPhase(state, 'reveal')
    state = apply(state, 'p0', { type: 'round/advanced' }) // reveal -> score
    state = apply(state, 'p0', { type: 'round/advanced' }) // score -> next round
    expect(state.round?.roleHolderId).toBe('p1')
  })
})

describe('scoring', () => {
  it('awards 3/2/1 by ballot position', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = playRound(state)
    expectPhase(state, 'reveal')

    // p1 authored r1-e1, p2 authored r1-e2, p3 authored r1-e3.
    // p0 ranks 1,2,3 → 3/2/1. p1 skips its own, ranks e2,e3 → 3/2.
    // p2 ranks e1,e3 → 3/2. p3 ranks e1,e2 → 3/2.
    const totals = scoresFrom(state.history)
    expect(totals.p1).toBe(3 + 3 + 3) // from p0, p2, p3
    expect(totals.p2).toBe(2 + 3 + 2) // from p0, p1, p3
    expect(totals.p3).toBe(1 + 2 + 2) // from p0, p1, p2
    expect(totals.p0 ?? 0).toBe(0) // the role holder did not compete
  })

  it('refuses a vote for your own entry', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state)
    state = apply(state, 'p0', {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'x' },
    })
    state = submitAll(state)
    state = expire(state) // waiting -> vote

    expect(
      authorize(state, {
        type: 'round/ballotCast',
        ballot: { kind: 'rank', ranked: ['r1-e1', 'r1-e2'] },
        at: at(),
        actor: 'p1',
      }),
    ).toBe('You cannot vote for your own — we checked.')
  })

  it('resolves a genuine two-way tie through the tiebreak', () => {
    let state = apply(room(3), 'p0', { type: 'game/started' })
    state = expire(state)
    state = apply(state, 'p0', {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'x' },
    })
    state = submitAll(state) // p1 -> r1-e1, p2 -> r1-e2
    state = expire(state)

    // p1 votes e2 first, p2 votes e1 first, p0 abstains until last.
    state = apply(state, 'p1', { type: 'round/ballotCast', ballot: { kind: 'rank', ranked: ['r1-e2'] } })
    state = apply(state, 'p2', { type: 'round/ballotCast', ballot: { kind: 'rank', ranked: ['r1-e1'] } })
    expectPhase(state, 'vote')
    state = expire(state) // clock runs out with p0 not having voted -> 3 all round

    expectPhase(state, 'tiebreak')
    expect(state.round?.tiebreak?.contenders).toEqual(['r1-e1', 'r1-e2'])

    // p1 authored r1-e1, so p1 can only back the other one. p0 decides it.
    state = apply(state, 'p1', { type: 'round/tiebreakVoted', choice: 'r1-e2' })
    state = apply(state, 'p2', { type: 'round/tiebreakVoted', choice: 'r1-e1' })
    state = apply(state, 'p0', { type: 'round/tiebreakVoted', choice: 'r1-e1' })

    expectPhase(state, 'reveal')
    const result = state.history[0]
    expect(result?.winnerEntryId).toBe('r1-e1')
    // 3 ranking points plus the sudden-death bonus.
    expect(result?.points.p1).toBe(3 + 1)
  })
})

describe('the clock', () => {
  it('ignores an expiry meant for a phase the room has already left', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    expectPhase(state, 'opener')
    state = expire(state) // opener -> brief
    const before = state

    // A late timer from the opener arrives after the room moved on.
    const after = reduce(state, { type: 'clock/expired', phase: 'opener', at: at(), actor: 'system' })
    expect(after).toBe(before) // identical reference, so no broadcast, no render
  })

  it('stores a deadline, not a countdown, and pause preserves what is left', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    expect(state.clock).toMatchObject({ status: 'running', totalMs: 3_800 })

    state = apply(state, 'p0', { type: 'host/paused' })
    expect(state.clock.status).toBe('paused')
    state = apply(state, 'p0', { type: 'host/resumed' })
    expect(state.clock.status).toBe('running')
  })

  it('treats a clock dragged to zero as expire-now, not a stalled deadline', () => {
    const state = apply(room(4), 'p0', { type: 'game/started' })
    const now = at()
    const next = reduce(state, { type: 'host/adjustedClock', deltaMs: -999_999, at: now, actor: 'p0' })
    expect(next.clock).toMatchObject({ status: 'running', endsAt: now })
  })

  it('picks a subject itself when the brief clock runs out', () => {
    let state = apply(room(4, { mode: 'react' }), 'p0', { type: 'game/started' })
    state = expire(state) // opener -> brief
    expect(state.round?.subject).toBeNull()
    state = expire(state) // brief -> compose, with a fallback
    expectPhase(state, 'compose')
    expect(state.round?.subject).toMatchObject({ kind: 'prompt' })
  })
})

describe('anonymity', () => {
  it('strips authorship from the broadcast while voting is open', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state)
    state = apply(state, 'p0', {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'x' },
    })
    state = submitAll(state)
    state = expire(state)
    expectPhase(state, 'vote')

    const seenByP0 = project(state, 'p0')
    expect(seenByP0.round?.entries.every((e) => e.authorId === undefined)).toBe(true)

    // ...but you keep your own, so the grid can dim and lock it.
    const seenByP1 = project(state, 'p1')
    expect(seenByP1.round?.entries.filter((e) => e.authorId === 'p1')).toHaveLength(1)
    expect(seenByP1.round?.entries.filter((e) => e.authorId === 'p2')).toHaveLength(0)
  })

  it('gives authorship back at the reveal', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = playRound(state)
    expectPhase(state, 'reveal')
    expect(project(state, 'p0').round?.entries.every((e) => e.authorId)).toBe(true)
  })
})

describe('a full five-round game', () => {
  it('reaches the podium with totals that match the history', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })

    for (let round = 1; round <= 5; round++) {
      expect(state.roundNumber).toBe(round)
      state = playRound(state)
      expectPhase(state, 'reveal')
      state = apply(state, 'p0', { type: 'round/advanced' }) // -> score
      expectPhase(state, 'score')
      state = apply(state, 'p0', { type: 'round/advanced' }) // -> next round or podium
    }

    expectPhase(state, 'podium')
    expect(state.history).toHaveLength(5)

    const table = standings(state)
    expect(table).toHaveLength(4)
    expect(table[0]?.rank).toBe(1)
    // The leader's share is the ceiling every other row is measured against.
    expect(table[0]?.share).toBe(1)

    const totals = scoresFrom(state.history)
    for (const row of table) {
      expect(row.score).toBe(totals[row.id] ?? 0)
    }
    // Every round produced a winner, so the wins add up to the rounds played.
    const wins = table.reduce((sum, r) => sum + r.roundWins, 0)
    expect(wins).toBe(5)
  })

  it('is reproducible from the seed', () => {
    const play = () => {
      let s = apply(room(4), 'p0', { type: 'game/started' })
      s = playRound(s)
      return s.round?.order
    }
    clock = 1_000
    const first = play()
    clock = 1_000
    const second = play()
    expect(first).toEqual(second)
  })
})

describe('viewKey', () => {
  it('splits one phase into the four faces the design draws', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state) // -> brief, caption mode, p0 holds the role
    expect(viewKey(state, 'p0')).toBe('pick')
    expect(viewKey(state, 'p1')).toBe('pickwait')

    let react = apply(room(4, { mode: 'react' }), 'p0', { type: 'game/started' })
    react = expire(react)
    expect(viewKey(react, 'p0')).toBe('prompt')
    expect(viewKey(react, 'p1')).toBe('promptwait')
  })
})

describe('seat colours', () => {
  it('gives every player who joins a colour from the palette', () => {
    let state = createRoom({
      roomCode: 'C-F34213',
      host: { id: 'p0', name: 'Jesse', avatarSeed: 'jesse' },
      seed: 42,
      at: at(),
    })
    for (let i = 1; i < 5; i++) {
      state = apply(state, `p${i}`, {
        type: 'player/joined',
        player: { id: `p${i}`, name: `Player ${i}`, avatarSeed: `p${i}` },
      })
    }

    // The gap this test exists for: joined players used to arrive with
    // `color: ''`, and only the fixtures patched it on afterwards — so every
    // real room rendered colourless avatars while the suite stayed green.
    expect(state.players.every((p) => p.color !== '')).toBe(true)
    expect(state.players.map((p) => p.color)).toEqual([0, 1, 2, 3, 4].map(colorFor))
  })

  it('cycles the palette past its seventh colour', () => {
    let state = createRoom({
      roomCode: 'C-F34213',
      host: { id: 'p0', name: 'Jesse', avatarSeed: 'jesse' },
      seed: 42,
      at: at(),
    })
    for (let i = 1; i <= PLAYER_COLORS.length; i++) {
      state = apply(state, `p${i}`, {
        type: 'player/joined',
        player: { id: `p${i}`, name: `Player ${i}`, avatarSeed: `p${i}` },
      })
    }
    const first = state.players[0]?.color
    const eighth = state.players[PLAYER_COLORS.length]?.color
    expect(eighth).toBe(first)
  })
})
