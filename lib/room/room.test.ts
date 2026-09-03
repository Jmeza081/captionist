import { describe, expect, it } from 'vitest'
import { createRoom } from '@/lib/game/create'
import {
  hasSubmitted,
  hasVoted,
  isRoleHolder,
  scoresFrom,
  voteCards,
} from '@/lib/game/selectors'
import type { GameMode, GameState, PublicState } from '@/lib/game/types'
import { DEFAULT_SETTINGS, RANK_POINTS } from '@/lib/game/constants'
import { stubBrain } from '@/lib/bots/stub'
import type { SeatedBot } from '@/lib/bots/types'
import { BotPool } from './BotPool'
import { GuestClient } from './GuestClient'
import { HostEngine, type TimerHandle } from './HostEngine'
import { LocalBus, createLocalTransport } from './LocalTransport'
import { createAutopilot } from './autopilot'
import type { Intent } from './transport'

/**
 * The phase-1 gate: a full game plays over the transport, driven only by
 * intents. Nothing here touches the reducer directly — that is the point.
 */

interface Harness {
  engine: HostEngine
  bus: LocalBus
  run: () => Promise<GameState>
  refusals: Array<{ intent: Intent; reason: string }>
}

/**
 * A virtual clock.
 *
 * Real timers would make a 5-round game take five minutes; faking them inside
 * the engine would stop testing the scheduling this phase exists to prove. So
 * time is a number the driver advances to whatever deadline is outstanding.
 */
function harness(mode: GameMode, bots: number, seed = 42): Harness {
  let now = 1_700_000_000_000
  let pending: { due: number; fn: () => void } | undefined

  const setTimer = (fn: () => void, ms: number): TimerHandle => {
    pending = { due: now + ms, fn }
    return 0 as unknown as TimerHandle
  }
  const clearTimer = (): void => {
    pending = undefined
  }

  const bus = new LocalBus('C-F34213', { latencyMs: 0 })
  const hostTransport = createLocalTransport({ bus, selfId: 'p0', isHost: true })
  const refusals: Array<{ intent: Intent; reason: string }> = []

  const initial = createRoom({
    roomCode: 'C-F34213',
    host: { id: 'p0', name: 'Jesse', avatarSeed: 'jesse' },
    settings: { mode },
    seed,
    at: now,
  })

  // Held in an object so `onChange` can close over it before the pool exists —
  // the pool needs `engine.apply`, so one of the two has to come second.
  const seated: { pool?: BotPool } = {}

  const engine = new HostEngine({
    transport: hostTransport,
    initial,
    now: () => now,
    setTimer,
    clearTimer,
    onChange: (state) => seated.pool?.observe(state),
    onRefused: (intent, reason) => refusals.push({ intent, reason }),
  })

  // No dwell: this harness runs on a virtual clock, and the dwell is a
  // product beat for a room someone is watching, not part of the protocol.
  const autopilot = createAutopilot({ engine, waitFor: bots + 1, dwellMs: 0 })

  // **The host plays too**, and it is a person — so it gets no pool seat and
  // no `bot` flag. It is driven straight off the written-in corpus over its
  // real transport, which keeps one player in this harness travelling the wire
  // exactly as a guest does.
  const hostSeat: SeatedBot = { id: 'p0', name: 'Jesse', difficulty: 'senior', index: 0 }
  const hostClient = new GuestClient({
    transport: hostTransport,
    now: () => now,
    onState: (state) => {
      void playHostSeat(state)
    },
  })
  hostClient.start()

  const hostDone = new Set<string>()
  async function playHostSeat(state: PublicState): Promise<void> {
    const key = `${state.roundNumber}:${state.phase}`
    if (hostDone.has(key)) return
    const ctx = {
      mode: state.settings.mode,
      format: state.settings.format,
      roundNumber: state.roundNumber,
    }
    if (state.phase === 'brief' && isRoleHolder(state, 'p0')) {
      hostDone.add(key)
      const subject = await stubBrain.subject({ ...ctx, bot: hostSeat })
      hostTransport.sendIntent({ type: 'round/subjectLocked', subject })
      return
    }
    if (state.phase === 'compose' && !isRoleHolder(state, 'p0') && !hasSubmitted(state, 'p0')) {
      const subject = state.round?.subject
      if (!subject) return
      hostDone.add(key)
      const answers = await stubBrain.answers({ ...ctx, bots: [hostSeat], subject })
      const answer = answers.get('p0')
      if (answer) hostTransport.sendIntent({ type: 'round/entrySubmitted', answer })
      return
    }
    if (state.phase === 'vote' && !hasVoted(state, 'p0')) {
      const cards = voteCards(state, 'p0')
        .filter((c) => !c.own)
        .map((c) => ({ entryId: c.entryId, text: c.lines?.join(' / ') ?? c.media?.alt ?? '' }))
      if (cards.length === 0) return
      hostDone.add(key)
      const ballots = await stubBrain.ballots({
        ...ctx,
        bots: [hostSeat],
        voting: state.settings.voting,
        places: RANK_POINTS.length,
        cards,
      })
      const ballot = ballots.get('p0')
      if (ballot) hostTransport.sendIntent({ type: 'round/ballotCast', ballot })
      return
    }
    if (state.phase === 'tiebreak') {
      const tiebreak = state.round?.tiebreak
      if (!tiebreak || tiebreak.votes.p0 !== undefined) return
      hostDone.add(key)
      const choice = tiebreak.contenders[0]
      if (choice) hostTransport.sendIntent({ type: 'round/tiebreakVoted', choice })
    }
  }

  // The bots the host hired. Host-local, so no transport and no client each —
  // they reach the engine directly, which is what ADR 0034 records.
  const pool = new BotPool({
    apply: (action, actor) => engine.apply(action, actor),
    snapshot: () => engine.snapshot(),
    now: () => now,
    // No dwell: this harness runs on a virtual clock, and the pause is a
    // product beat for a room someone is watching, not part of the protocol.
    wait: () => Promise.resolve(),
  })
  seated.pool = pool
  for (let i = 0; i < bots; i += 1) pool.add('senior')

  engine.start()

  const run = async (): Promise<GameState> => {
    for (let step = 0; step < 4_000; step++) {
      await bus.flush()
      // Autopilot after the bus settles, so joins land before the game starts.
      autopilot(engine.snapshot())
      await bus.flush()
      if (engine.snapshot().phase === 'podium') break
      if (!pending) continue
      const due = pending
      pending = undefined
      now = Math.max(now, due.due)
      due.fn()
    }
    return engine.snapshot()
  }

  return { engine, bus, run, refusals }
}

describe('the room spine', () => {
  it('plays a full caption game to the podium over the transport', async () => {
    const h = harness('caption', 4)
    const final = await h.run()

    expect(final.phase).toBe('podium')
    // Off the constant, not a literal: the default round count is derived from
    // the room's size and the GIF allowance now, so a test that hardcodes it
    // fails for a reason that has nothing to do with the room spine.
    expect(final.roundNumber).toBe(DEFAULT_SETTINGS.totalRounds)
    expect(final.history).toHaveLength(DEFAULT_SETTINGS.totalRounds)
    expect(final.players).toHaveLength(5)
  })

  it('plays a full react game to the podium', async () => {
    const h = harness('react', 4)
    const final = await h.run()

    expect(final.phase).toBe('podium')
    expect(final.history).toHaveLength(DEFAULT_SETTINGS.totalRounds)
  })

  it('awards points only to players who competed', async () => {
    const h = harness('caption', 4)
    const final = await h.run()
    const scores = scoresFrom(final.history)

    // Every round has a winner, so the table cannot be empty.
    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(0)
    for (const id of Object.keys(scores)) {
      expect(final.players.some((p) => p.id === id)).toBe(true)
    }
  })

  it('is reproducible from the seed', async () => {
    const a = await harness('caption', 4, 42).run()
    const b = await harness('caption', 4, 42).run()
    expect(scoresFrom(b.history)).toEqual(scoresFrom(a.history))
    expect(b.history.map((r) => r.winnerEntryId)).toEqual(a.history.map((r) => r.winnerEntryId))
  })

  it('runs the minimum room of three', async () => {
    const final = await harness('caption', 2).run()
    expect(final.phase).toBe('podium')
    expect(final.players).toHaveLength(3)
  })
})
