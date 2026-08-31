import { describe, expect, it } from 'vitest'
import type { ActionInput, GameAction } from './actions'
import { authorize } from './authorize'
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PHASE_DURATIONS,
  PLAYER_COLORS,
  ROUNDS_MAX,
  ROUNDS_MIN,
  WAITING_ALL_IN_MS,
  colorFor,
  roundsMaxFor,
} from './constants'
import { createRoom } from './create'
import { project } from './project'
import { fixtureFor, lobbyFixture } from './fixtures'
import { HAT_IDS } from '@/lib/hats'
import { reduce } from './reducer'
import { competitors, scoresFrom, standings, submittedCount, viewKey } from './selectors'
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
    subject: { kind: 'media', media: { src: 'g.gif', alt: 'a gif' } },
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

  it('shortens the wait to a beat when the last entry is what ended it', () => {
    // `waiting` is entered two ways and they are not the same wait. Everyone
    // in: nothing to wait for, so the room reads its confirmation and moves.
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state)
    state = apply(state, 'p0', {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'Prod is fine.' },
    })
    state = submitAll(state)
    expectPhase(state, 'waiting')
    expect(state.clock.status === 'running' && state.clock.totalMs).toBe(WAITING_ALL_IN_MS)
  })

  it('keeps the full wait when the compose clock left somebody behind', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state)
    state = apply(state, 'p0', {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'Prod is fine.' },
    })
    state = apply(state, 'p1', {
      type: 'round/entrySubmitted',
      answer: { kind: 'caption', lines: ['Only one of us is on call.'] },
    })
    expectPhase(state, 'compose')
    state = expire(state) // compose -> waiting, two still out
    expectPhase(state, 'waiting')
    expect(submittedCount(state)).toEqual({ done: 1, total: 3 })
    expect(state.clock.status === 'running' && state.clock.totalMs).toBe(
      PHASE_DURATIONS.waiting,
    )
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

  it('awards one point a ballot in a single-vote room, not three', () => {
    // The reducer's single branch was always right; nothing reached it. Both
    // ballot builders hardcoded `kind: 'rank'`, so a room whose label promised
    // one point paid `RANK_POINTS[0]`.
    let state = apply(room(4, { voting: 'single' }), 'p0', { type: 'game/started' })
    state = expire(state)
    state = apply(state, 'p0', {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'x' },
    })
    state = submitAll(state)
    state = expire(state) // waiting -> vote

    // p1 authored r1-e1, p2 authored r1-e2, p3 authored r1-e3.
    state = apply(state, 'p0', { type: 'round/ballotCast', ballot: { kind: 'single', choice: 'r1-e1' } })
    state = apply(state, 'p2', { type: 'round/ballotCast', ballot: { kind: 'single', choice: 'r1-e1' } })
    state = apply(state, 'p3', { type: 'round/ballotCast', ballot: { kind: 'single', choice: 'r1-e1' } })
    state = apply(state, 'p1', { type: 'round/ballotCast', ballot: { kind: 'single', choice: 'r1-e2' } })

    expectPhase(state, 'reveal')
    const result = state.history[0]
    expect(result?.winnerEntryId).toBe('r1-e1')
    // Three people picked it, one point each — not 3/2/1.
    expect(result?.points.p1).toBe(3)
    expect(result?.points.p2).toBe(1)
    expect(result?.points.p3 ?? 0).toBe(0)
  })

  it('refuses a ranking in a room that takes one vote each', () => {
    // Not only the screen's bug: `authorize` never compared the ballot's kind
    // to the room's setting, so any client could rank in a single-vote room.
    let state = apply(room(4, { voting: 'single' }), 'p0', { type: 'game/started' })
    state = expire(state)
    state = apply(state, 'p0', {
      type: 'round/subjectLocked',
      subject: { kind: 'prompt', text: 'x' },
    })
    state = submitAll(state)
    state = expire(state)

    expect(
      authorize(state, {
        type: 'round/ballotCast',
        ballot: { kind: 'rank', ranked: ['r1-e1', 'r1-e2', 'r1-e3'] },
        at: at(),
        actor: 'p0',
      }),
    ).toBe('This room takes one vote each, not a ranking.')

    // A one-deep ranking stays legal — it is what a two-entry room casts, and
    // what the tiebreak fixture builds.
    expect(
      authorize(state, {
        type: 'round/ballotCast',
        ballot: { kind: 'rank', ranked: ['r1-e1'] },
        at: at(),
        actor: 'p0',
      }),
    ).toBe(true)
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

describe('a hat on the wire', () => {
  it('carries what a player picked', () => {
    const state = apply(room(2), 'p1', {
      type: 'player/joined',
      player: { id: 'p9', name: 'Vic', avatarSeed: 'fern', hat: 'wizard' },
    })
    expect(state.players.at(-1)?.hat).toBe('wizard')
  })

  /**
   * The one that matters. A hat id arrives from another player's browser and
   * becomes a URL, so it is narrowed at the door — and the crown is outside
   * the sixteen precisely so this cannot succeed. Nobody crowns themselves.
   */
  it('refuses a crown claimed rather than earned', () => {
    const state = apply(room(2), 'p1', {
      type: 'player/joined',
      player: { id: 'p9', name: 'Vic', avatarSeed: 'fern', hat: 'crown' as never },
    })
    expect(state.players.at(-1)?.hat).toBeUndefined()
  })

  it('refuses anything that is not one of the sixteen', () => {
    for (const hat of ['../../etc/passwd', '__proto__', '', 7 as never]) {
      const state = apply(room(2), 'p1', {
        type: 'player/joined',
        player: { id: 'p9', name: 'Vic', avatarSeed: 'fern', hat: hat as never },
      })
      expect(state.players.at(-1)?.hat, String(hat)).toBeUndefined()
    }
  })

  it('leaves a full room’s broadcast inside Ably’s cap', () => {
    // Invariant 1 in `types.ts`, measured rather than asserted. Every seat the
    // room allows, all of them wearing something.
    //
    // Counted off `MAX_PLAYERS` rather than a literal, so this keeps testing a
    // *full* room after the ceiling moved from twenty to ten — see the
    // constant for why it did.
    let state = room(2)
    for (let i = 0; i < MAX_PLAYERS - 2; i++) {
      state = apply(state, 'p1', {
        type: 'player/joined',
        player: {
          id: `x${i}`,
          name: `Extra ${i}`,
          avatarSeed: `seed-${i}`,
          hat: HAT_IDS[i % HAT_IDS.length],
        },
      })
    }
    expect(state.players).toHaveLength(MAX_PLAYERS)
    expect(JSON.stringify(project(state, 'p0')).length).toBeLessThan(64_000)
  })
})

describe('an entry', () => {
  it('replaces the author’s previous one rather than adding a second', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state) // opener -> brief
    state = expire(state) // brief -> compose

    state = apply(state, 'p1', {
      type: 'round/entrySubmitted',
      answer: { kind: 'caption', lines: ['First thought'] },
    })
    state = apply(state, 'p1', {
      type: 'round/entrySubmitted',
      answer: { kind: 'caption', lines: ['Better thought'] },
    })

    // The upsert is unreachable from the UI now — the composer hands over to
    // the waiting face the moment you submit — so this is the only thing left
    // holding it, and it still matters: a bot or a resent message must not
    // give one player two entries in the grid.
    const mine = state.round?.entries.filter((e) => e.authorId === 'p1') ?? []
    expect(mine).toHaveLength(1)
    expect(mine[0]?.answer).toEqual({ kind: 'caption', lines: ['Better thought'] })
  })
})

describe('a brief nobody answered', () => {
  it('still hands the room an image to caption', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })
    state = expire(state) // opener -> brief
    expectPhase(state, 'brief')

    // Nobody picks. This used to leave everyone captioning an empty frame —
    // one player's hesitation spoiling the round for the other three.
    state = expire(state)
    expectPhase(state, 'compose')

    const subject = state.round?.subject
    expect(subject?.kind).toBe('media')
    expect(subject?.kind === 'media' && subject.media.src).toMatch(/^\/media\/stub-/)
  })

  it('picks the same image for every client, because the room’s seed chose it', () => {
    const start = () => {
      let state = apply(room(4), 'p0', { type: 'game/started' })
      state = expire(state)
      return expire(state)
    }
    const a = start()
    const b = start()
    const src = (s: GameState) =>
      s.round?.subject?.kind === 'media' ? s.round.subject.media.src : undefined
    expect(src(a)).toBe(src(b))
  })

  it('falls back to a prompt in the reversed mode, not to an image', () => {
    let state = apply(room(4, { mode: 'react' }), 'p0', { type: 'game/started' })
    state = expire(state)
    state = expire(state)
    expect(state.round?.subject?.kind).toBe('prompt')
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

describe('a full game, however many rounds that is', () => {
  it('reaches the podium with totals that match the history', () => {
    let state = apply(room(4), 'p0', { type: 'game/started' })

    for (let round = 1; round <= DEFAULT_SETTINGS.totalRounds; round++) {
      expect(state.roundNumber).toBe(round)
      state = playRound(state)
      expectPhase(state, 'reveal')
      state = apply(state, 'p0', { type: 'round/advanced' }) // -> score
      expectPhase(state, 'score')
      state = apply(state, 'p0', { type: 'round/advanced' }) // -> next round or podium
    }

    expectPhase(state, 'podium')
    expect(state.history).toHaveLength(DEFAULT_SETTINGS.totalRounds)

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
    expect(wins).toBe(DEFAULT_SETTINGS.totalRounds)
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

describe('joining late', () => {
  it('seats someone who arrives mid-round without giving them the round', () => {
    const state = fixtureFor('compose', { players: 5 })
    const next = reduce(state, {
      type: 'player/joined',
      player: { id: 'late', name: 'Roberto', avatarSeed: 'fern' },
      at: 1_700_000_100_000,
      actor: 'late',
    })

    // In the room…
    expect(next.players.map((p) => p.id)).toContain('late')
    // …but not in this round: they have no entry, so nobody waits on one.
    expect(next.round?.entries.some((e) => e.authorId === 'late')).toBe(false)
    expect(competitors(next).some((p) => p.id === 'late')).toBe(true)
  })

  it('is allowed in every phase, because the lobby promises it is', () => {
    for (const phase of ['compose', 'vote', 'reveal', 'score'] as const) {
      const state = fixtureFor(phase, { players: 5 })
      const verdict = authorize(state, {
        type: 'player/joined',
        player: { id: 'late', name: 'Roberto', avatarSeed: 'fern' },
        at: 1_700_000_100_000,
        actor: 'late',
      })
      expect(verdict, phase).toBe(true)
    }
  })
})

describe('running out of GIFs', () => {
  it('ends the game from any phase a round runs in, keeping the scores so far', () => {
    for (const phase of ['brief', 'compose', 'waiting', 'vote', 'reveal', 'score'] as const) {
      const state = fixtureFor(phase, { players: 5 })
      const next = apply(state, 'p1', { type: 'game/gifsExhausted' })

      expect(next.phase, phase).toBe('podium')
      // The round in progress is abandoned — it never reached `history`, so
      // there is nothing to unwind.
      expect(next.round, phase).toBeNull()
      expect(next.history, phase).toEqual(state.history)
      // The podium has something to explain, and this is how it knows.
      expect(next.endedBecause, phase).toBe('gifs')
    }
  })

  it('is reportable by any seated player, not just the host', () => {
    const state = fixtureFor('compose', { players: 5 })

    // Only the client that got the 429 can observe it, and that is rarely the
    // host — they may be the role holder, or sitting the round out.
    expect(state.hostId).not.toBe('p3')
    expect(authorize(state, { type: 'game/gifsExhausted', at: at(), actor: 'p3' })).toBe(true)
  })

  it('is refused once the game is already over, so a straggler cannot reopen it', () => {
    const state = fixtureFor('podium', { players: 5 })

    // Two clients hitting the same 429 is the normal case, not the edge one.
    expect(authorize(state, { type: 'game/gifsExhausted', at: at(), actor: 'p2' })).not.toBe(
      true,
    )
  })

  it('is refused in the lobby, where nobody has opened a picker yet', () => {
    const state = lobbyFixture({ players: 5 })

    expect(authorize(state, { type: 'game/gifsExhausted', at: at(), actor: 'p2' })).not.toBe(
      true,
    )
  })

  it('stops apologising once the room restarts', () => {
    const ended = apply(fixtureFor('vote', { players: 5 }), 'p1', {
      type: 'game/gifsExhausted',
    })
    const again = apply(ended, ended.hostId, { type: 'host/restarted' })

    // Or the next podium would still be explaining the last game's rate limit.
    expect(again.endedBecause).toBeUndefined()
  })
})

describe('room size and round count', () => {
  it('affords fewer rounds the bigger the room gets', () => {
    // Every competitor opens a picker every round, so seats times rounds is
    // what the GIF allowance buys. These are the numbers `/host` shows.
    expect(roundsMaxFor(3)).toBe(5)
    expect(roundsMaxFor(6)).toBe(5)
    expect(roundsMaxFor(7)).toBe(5)
    expect(roundsMaxFor(8)).toBe(4)
    expect(roundsMaxFor(9)).toBe(4)
    expect(roundsMaxFor(10)).toBe(3)
  })

  it('never returns a bound the stepper cannot show', () => {
    for (let size = MIN_PLAYERS; size <= MAX_PLAYERS; size++) {
      const max = roundsMaxFor(size)
      expect(max, `size ${size}`).toBeGreaterThanOrEqual(ROUNDS_MIN)
      expect(max, `size ${size}`).toBeLessThanOrEqual(ROUNDS_MAX)
    }
  })

  it('clamps the round count when the room grows past what it affords', () => {
    const small = fixtureFor('lobby', { players: 3 })
    const five = apply(small, small.hostId, {
      type: 'room/settingsChanged',
      patch: { maxPlayers: 6, totalRounds: 5 },
    })
    expect(five.settings.totalRounds).toBe(5)

    // Widening the room to ten strands five rounds above what ten seats can
    // pay for, and a host dragging one stepper should not have to notice.
    const wide = apply(five, five.hostId, {
      type: 'room/settingsChanged',
      patch: { maxPlayers: 10 },
    })
    expect(wide.settings.maxPlayers).toBe(10)
    expect(wide.settings.totalRounds).toBe(3)
  })

  it('leaves a round count the new size can still afford alone', () => {
    const state = fixtureFor('lobby', { players: 3 })
    const two = apply(state, state.hostId, {
      type: 'room/settingsChanged',
      patch: { maxPlayers: 10, totalRounds: 2 },
    })
    // Two fits inside ten seats, so nothing is taken away.
    expect(two.settings.totalRounds).toBe(2)
  })

  it('fills against the room’s own size, not the global ceiling', () => {
    const state = fixtureFor('lobby', { players: 5 })
    const small = apply(state, state.hostId, {
      type: 'room/settingsChanged',
      patch: { maxPlayers: 5 },
    })

    // Five seats, five taken. The refusal names the host's number, not ten.
    const verdict = authorize(small, {
      type: 'player/joined',
      player: { id: 'late', name: 'Roberto', avatarSeed: 'fern' },
      at: at(),
      actor: 'late',
    })
    expect(verdict).toBe('This room is full — 5 players is the limit.')
  })
})
