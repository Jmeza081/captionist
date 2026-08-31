import type { ActionInput, GameAction } from './actions'
import { authorize } from './authorize'
import { createRoom } from './create'
import { reduce } from './reducer'
import { ballotFrom } from './selectors'
import { sampleAt } from '@/lib/gifs/samples'
import { HAT_IDS } from '@/lib/hats'
import { toMediaRef } from '@/lib/gifs/types'
import type { EntryAnswer, GameState, RoomPhase, RoomSettings } from './types'

/**
 * Seeded rooms, one per phase.
 *
 * Two jobs: booting a dev route straight into the screen being worked on, and
 * giving Playwright a `?phase=vote` lever so each screen gets a spec without
 * playing three minutes of game first.
 *
 * Every fixture is built by *actually playing* through the reducer rather than
 * hand-writing a state object. A hand-written fixture drifts from what the
 * reducer can really produce, and then a screen gets built against a shape the
 * game never reaches.
 */

const NAMES = ['Jesse', 'Jesska', 'Melania', 'Lukasz', 'Jack', 'Vic', 'Roberto']

const CAPTIONS = [
  'It compiles. Ship it.',
  'Works on my machine, which is now on fire.',
  'The rollback also failed.',
  'Day three of the two-hour migration.',
  'Nobody tell the on-call.',
  'This is fine, per the retro.',
]

let tick = 1_700_000_000_000

function at(): number {
  tick += 1_000
  return tick
}

function step(state: GameState, actor: string, action: ActionInput): GameState {
  const full = { ...action, at: at(), actor } as GameAction
  const verdict = authorize(state, full)
  if (verdict !== true) throw new Error(`fixture: ${action.type} rejected — ${verdict}`)
  return reduce(state, full)
}

function expire(state: GameState): GameState {
  return reduce(state, { type: 'clock/expired', phase: state.phase, at: at(), actor: 'system' })
}

export interface FixtureOptions {
  players?: number
  settings?: Partial<RoomSettings>
  seed?: number
  /**
   * How many competitors to hold back at `waiting`.
   *
   * `waiting` is normally entered by the last entry landing, which means the
   * tracker always reads N of N and the straggler face — the only one that
   * still offers the host a button — is unreachable from a `?phase=` jump. The
   * room really gets there by the *compose* clock expiring on someone, so that
   * is what this reproduces.
   */
  out?: number
}

/** A lobby with `players` people in it, coloured and named like the design's. */
export function lobbyFixture(options: FixtureOptions = {}): GameState {
  const count = options.players ?? 5
  tick = 1_700_000_000_000
  let state = createRoom({
    roomCode: 'C-F34213',
    host: { id: 'p0', name: NAMES[0] ?? 'Jesse', avatarSeed: 'jesse', hat: 'party' },
    settings: options.settings,
    seed: options.seed ?? 42,
    at: at(),
  })
  for (let i = 1; i < count; i++) {
    state = step(state, `p${i}`, {
      type: 'player/joined',
      // Dressed deterministically, so every `?phase=` screen shows the hat path
      // and `?phase=score` is a crown fixture without a line of setup.
      player: {
        id: `p${i}`,
        name: NAMES[i] ?? `Player ${i}`,
        avatarSeed: `p${i}`,
        hat: HAT_IDS[i % HAT_IDS.length],
      },
    })
  }
  return state
}

function answerFor(state: GameState, index: number): EntryAnswer {
  if (state.settings.mode === 'caption') {
    return { kind: 'caption', lines: [CAPTIONS[index % CAPTIONS.length] ?? 'A caption'] }
  }
  // Real art from the offline shelf rather than an empty `src`. A harness
  // screen exists to be a spec for a screen, and a vote grid of blank frames
  // is a worse one — it also hid the fact that a card is drawn at its image's
  // ratio, because a card with no image has no ratio to be drawn at.
  return { kind: 'media', media: toMediaRef(sampleAt(index)) }
}

/**
 * Plays forward to `phase` and stops there.
 *
 * `reveal`, `score` and `podium` need a completed round behind them, so they
 * play the whole loop rather than jumping.
 */
export function fixtureFor(phase: RoomPhase, options: FixtureOptions = {}): GameState {
  let state = lobbyFixture(options)
  if (phase === 'lobby') return state

  state = step(state, 'p0', { type: 'game/started' })
  if (phase === 'opener') return state

  state = expire(state) // opener -> brief
  if (phase === 'brief') return state

  state = step(state, state.round?.roleHolderId ?? 'p0', {
    type: 'round/subjectLocked',
    subject:
      state.settings.mode === 'caption'
        ? { kind: 'media', media: toMediaRef(sampleAt(0)) }
        : { kind: 'prompt', text: 'The deploy went out at 4:59pm on a Friday.' },
  })
  if (phase === 'compose') return state

  const competitors = state.players.filter((p) => p.id !== state.round?.roleHolderId)
  // The last `out` competitors never submit — see `FixtureOptions.out`. With
  // none held back the final entry flips `compose` to `waiting` on its own;
  // with some, the phase has to be timed out from under them, which is exactly
  // how a real room reaches a wait it still has someone to wait for.
  const held = Math.min(Math.max(options.out ?? 0, 0), competitors.length)
  competitors.slice(0, competitors.length - held).forEach((p, i) => {
    state = step(state, p.id, { type: 'round/entrySubmitted', answer: answerFor(state, i) })
  })
  if (state.phase === 'compose') state = expire(state) // compose -> waiting
  if (phase === 'waiting') return state

  state = expire(state) // waiting -> vote
  if (phase === 'vote') return state

  const entryIds = state.round?.entries.map((e) => e.id) ?? []

  if (phase === 'tiebreak') {
    // Two entries level at the top, so the room goes to sudden death.
    const [a, b] = entryIds
    if (a && b) {
      const voterA = state.players.find((p) => p.id !== state.round?.entries[0]?.authorId)
      const voterB = state.players.find(
        (p) => p.id !== state.round?.entries[1]?.authorId && p.id !== voterA?.id,
      )
      const ballotA = ballotFrom(state, [a])
      const ballotB = ballotFrom(state, [b])
      if (voterA && ballotA) state = step(state, voterA.id, { type: 'round/ballotCast', ballot: ballotA })
      if (voterB && ballotB) state = step(state, voterB.id, { type: 'round/ballotCast', ballot: ballotB })
    }
    state = expire(state) // vote -> tally -> tiebreak
    return state
  }

  for (const p of state.players) {
    const own = state.round?.entries.find((e) => e.authorId === p.id)
    const ranked = entryIds.filter((id) => id !== own?.id).slice(0, 3)
    // Through `ballotFrom` rather than a hardcoded `rank`, so a single-vote
    // fixture casts what a single-vote room scores. Hardcoding it here paid
    // 3/2/1 in a room that promised 1, and `authorize` now refuses it outright.
    const ballot = ballotFrom(state, ranked)
    if (ballot) {
      state = step(state, p.id, { type: 'round/ballotCast', ballot })
    }
  }
  if (state.phase === 'tiebreak') state = expire(state)
  if (phase === 'reveal') return state

  state = step(state, 'p0', { type: 'round/advanced' }) // reveal -> score
  if (phase === 'score') return state

  // Podium: run out the remaining rounds.
  while (state.phase !== 'podium') {
    if (state.phase === 'score') {
      state = step(state, 'p0', { type: 'round/advanced' })
      continue
    }
    if (state.phase === 'reveal') {
      state = step(state, 'p0', { type: 'round/advanced' })
      continue
    }
    if (state.phase === 'brief') {
      state = step(state, state.round?.roleHolderId ?? 'p0', {
        type: 'round/subjectLocked',
        subject: { kind: 'prompt', text: 'Prod is fine.' },
      })
      continue
    }
    if (state.phase === 'compose') {
      const rest = state.players.filter((p) => p.id !== state.round?.roleHolderId)
      rest.forEach((p, i) => {
        state = step(state, p.id, { type: 'round/entrySubmitted', answer: answerFor(state, i) })
      })
      continue
    }
    if (state.phase === 'vote') {
      const ids = state.round?.entries.map((e) => e.id) ?? []
      for (const p of state.players) {
        const own = state.round?.entries.find((e) => e.authorId === p.id)
        const ranked = ids.filter((id) => id !== own?.id).slice(0, 3)
        if (ranked.length > 0) {
          state = step(state, p.id, { type: 'round/ballotCast', ballot: { kind: 'rank', ranked } })
        }
      }
      continue
    }
    state = expire(state)
  }
  return state
}

/** Every phase a fixture can boot into — the `?phase=` allowlist. */
export const FIXTURE_PHASES: readonly RoomPhase[] = [
  'lobby',
  'opener',
  'brief',
  'compose',
  'waiting',
  'vote',
  'tiebreak',
  'reveal',
  'score',
  'podium',
]
