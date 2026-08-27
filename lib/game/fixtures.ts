import type { ActionInput, GameAction } from './actions'
import { authorize } from './authorize'
import { createRoom } from './create'
import { reduce } from './reducer'
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
}

/** A lobby with `players` people in it, coloured and named like the design's. */
export function lobbyFixture(options: FixtureOptions = {}): GameState {
  const count = options.players ?? 5
  tick = 1_700_000_000_000
  let state = createRoom({
    roomCode: 'C-F34213',
    host: { id: 'p0', name: NAMES[0] ?? 'Jesse', avatarSeed: 'jesse' },
    settings: options.settings,
    seed: options.seed ?? 42,
    at: at(),
  })
  for (let i = 1; i < count; i++) {
    state = step(state, `p${i}`, {
      type: 'player/joined',
      player: { id: `p${i}`, name: NAMES[i] ?? `Player ${i}`, avatarSeed: `p${i}` },
    })
  }
  return state
}

function answerFor(state: GameState, index: number): EntryAnswer {
  if (state.settings.mode === 'caption') {
    return { kind: 'caption', lines: [CAPTIONS[index % CAPTIONS.length] ?? 'A caption'] }
  }
  return {
    kind: 'media',
    media: { src: '', alt: `Answer ${index + 1}`, source: 'giphy' },
  }
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
        ? { kind: 'media', media: { src: '', alt: 'The round’s image', source: 'giphy' } }
        : { kind: 'prompt', text: 'The deploy went out at 4:59pm on a Friday.' },
  })
  if (phase === 'compose') return state

  const competitors = state.players.filter((p) => p.id !== state.round?.roleHolderId)
  // Leave the last competitor out for `compose`-adjacent states so the tracker
  // has something to show; everyone submits from `waiting` onward.
  competitors.forEach((p, i) => {
    state = step(state, p.id, { type: 'round/entrySubmitted', answer: answerFor(state, i) })
  })
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
      if (voterA) state = step(state, voterA.id, { type: 'round/ballotCast', ballot: { kind: 'rank', ranked: [a] } })
      if (voterB) state = step(state, voterB.id, { type: 'round/ballotCast', ballot: { kind: 'rank', ranked: [b] } })
    }
    state = expire(state) // vote -> tally -> tiebreak
    return state
  }

  for (const p of state.players) {
    const own = state.round?.entries.find((e) => e.authorId === p.id)
    const ranked = entryIds.filter((id) => id !== own?.id).slice(0, 3)
    if (ranked.length > 0) {
      state = step(state, p.id, { type: 'round/ballotCast', ballot: { kind: 'rank', ranked } })
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
