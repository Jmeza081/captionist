import { describe, expect, it } from 'vitest'
import { createRoom } from '@/lib/game/create'
import { scoresFrom } from '@/lib/game/selectors'
import type { GameMode, GameState } from '@/lib/game/types'
import { BotDriver } from './BotDriver'
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

  const engine = new HostEngine({
    transport: hostTransport,
    initial,
    now: () => now,
    setTimer,
    clearTimer,
    onRefused: (intent, reason) => refusals.push({ intent, reason }),
  })

  // No dwell: this harness runs on a virtual clock, and the dwell is a
  // product beat for a room someone is watching, not part of the protocol.
  const autopilot = createAutopilot({ engine, waitFor: bots + 1, dwellMs: 0 })

  // The host plays too, so it needs a bot brain of its own for compose/vote.
  const hostBot = new BotDriver({ id: 'p0', name: 'Jesse', index: 0, send: (a) => engine.apply(a, 'p0') })
  const hostClient = new GuestClient({
    transport: hostTransport,
    now: () => now,
    onState: (state) => hostBot.observe(state),
  })
  hostClient.start()

  for (let i = 1; i <= bots; i++) {
    const id = `p${i}`
    const transport = createLocalTransport({ bus, selfId: id, isHost: false })
    const bot = new BotDriver({ id, name: `Bot ${i}`, index: i, send: (a) => transport.sendIntent(a) })
    const client = new GuestClient({ transport, now: () => now, onState: (s) => bot.observe(s) })
    client.start()
  }

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
    expect(final.roundNumber).toBe(5)
    expect(final.history).toHaveLength(5)
    expect(final.players).toHaveLength(5)
  })

  it('plays a full react game to the podium', async () => {
    const h = harness('react', 4)
    const final = await h.run()

    expect(final.phase).toBe('podium')
    expect(final.history).toHaveLength(5)
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
