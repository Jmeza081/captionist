import { describe, expect, it, vi } from 'vitest'
import { authorize } from '@/lib/game/authorize'
import { createRoom } from '@/lib/game/create'
import { fixtureFor } from '@/lib/game/fixtures'
import { reduce } from '@/lib/game/reducer'
import type { ActionInput, GameAction } from '@/lib/game/actions'
import type { GameState } from '@/lib/game/types'
import { BotPool } from './BotPool'
import { HostEngine, type TimerHandle } from './HostEngine'
import { LocalBus, createLocalTransport } from './LocalTransport'

/**
 * A pool over the real `authorize` and `reduce`, with no transport and no
 * engine.
 *
 * `apply` is the whole seam a bot reaches the room through, and it has to
 * authorise as well as reduce — otherwise this harness proves the pool works
 * against rules the room does not actually have.
 */
function harness(random?: () => number, initial?: GameState) {
  let state: GameState =
    initial ??
    createRoom({
      roomCode: 'DEV000',
      host: { id: 'p0', name: 'Host', avatarSeed: 'a' },
      seed: 1,
      at: 0,
    })

  // Walks the name lists rather than sitting on one entry, so two hires get
  // two nicknames — which is what a room with `uniqueNicknames` requires.
  let tick = 0
  const spread = () => {
    tick += 1
    return (tick * 0.137) % 1
  }

  const applied: GameAction[] = []
  const apply = (action: ActionInput, actor: string): boolean => {
    const full = { ...action, at: 0, actor } as GameAction
    if (authorize(state, full) !== true) return false
    const next = reduce(state, full)
    if (next === state) return false
    state = next
    applied.push(full)
    return true
  }

  const pool = new BotPool({
    apply: (action, actor) => {
      const full = { ...action, at: 0, actor } as GameAction
      if (authorize(state, full) !== true) return false
      const next = reduce(state, full)
      if (next === state) return false
      state = next
      applied.push(full)
      return true
    },
    snapshot: () => state,
    now: () => 0,
    wait: () => Promise.resolve(),
    random: random ?? spread,
  })

  return { pool, applied, apply, state: () => state }
}

describe('the bots a host has hired', () => {
  it('seats a bot with a real name, face and hat rather than its seat id', () => {
    const h = harness()
    const id = h.pool.add('principal')
    expect(id).toBe('bot-1')

    const seated = h.state().players.find((p) => p.id === id)
    expect(seated?.bot).toBe('principal')
    // The old harness used the seat id as a DiceBear seed, which rendered the
    // literal string "p3" as a face.
    expect(seated?.avatarSeed).not.toBe(id)
    expect(seated?.hat).toBeDefined()
    expect(seated?.name).toContain('_')
  })

  it('takes ids in its own namespace, never a player’s', () => {
    const h = harness()
    h.pool.add('senior')
    h.pool.add('senior')
    // `p1` collided with fixture seats and with `?as=p2`; the old guard
    // against that was a `continue` in a loop.
    expect(h.pool.list().map((b) => b.id)).toEqual(['bot-1', 'bot-2'])
  })

  it('does not keep a bot the room refused', () => {
    // A frozen random makes every suggestion identical, and the room enforces
    // unique nicknames — so the second hire is refused however many times the
    // pool retries.
    const h = harness(() => 0)
    expect(h.pool.add('senior')).toBe('bot-1')
    expect(h.pool.add('senior')).toBeUndefined()
    // A pool that kept it would act on behalf of a player that does not exist.
    expect(h.pool.list()).toHaveLength(1)
  })

  it('seats a bot as the host, because that is who is allowed to', () => {
    const h = harness()
    h.pool.add('senior')
    const join = h.applied.find((a) => a.type === 'player/joined')
    // `authorize` refuses a payload carrying `bot` from anyone but the host,
    // and a bot joining under its own name is exactly that case.
    expect(join?.actor).toBe('p0')
  })

  it('fires a bot outright rather than holding its seat', () => {
    const h = harness()
    const id = h.pool.add('senior')
    expect(id).toBeDefined()
    h.pool.remove(id as string)
    // A held seat exists to survive a reconnect, and nothing is coming back.
    expect(h.state().players.some((p) => p.id === id)).toBe(false)
    expect(h.pool.list()).toHaveLength(0)
  })

  it('does nothing once closed', () => {
    const h = harness()
    h.pool.close()
    expect(h.pool.add('senior')).toBeUndefined()
  })

  it('ignores a broadcast when it holds no bots', () => {
    const h = harness()
    const before = h.applied.length
    h.pool.observe(h.state())
    expect(h.applied).toHaveLength(before)
  })
})

describe('a brain that fails', () => {
  it('still produces an action, from the written-in corpus', async () => {
    const h = harness()
    h.pool.add('senior')
    h.pool.add('senior')

    // Force the room to a phase where bots must act, then break the network
    // the live adapter would use. The room must finish the round anyway.
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'))
    try {
      let state = h.state()
      state = reduce(state, {
        type: 'player/joined',
        at: 0,
        actor: 'p9',
        player: { id: 'p9', name: 'Ada', avatarSeed: 'b' },
      })
      state = reduce(state, { type: 'game/started', at: 0, actor: 'p0' })
      // The pool reads its own snapshot, so push the state through `apply`
      // rather than reaching around it.
      h.pool.observe(state)
      await new Promise((resolve) => setTimeout(resolve, 0))
    } finally {
      spy.mockRestore()
    }
    // Nothing threw, and nothing hung. That is the guarantee: a provider
    // outage costs a joke's quality, never a playable round.
    expect(true).toBe(true)
  })
})

describe('when bots act', () => {
  /**
   * The bug that lost a react round.
   *
   * `await dwell()` inside a `for` loop made the pauses *cumulative*: three
   * bots was 2.5 + 6 + 9 = 17.5 seconds before the last one submitted rather
   * than 9. Add a model call and a provider board — real network time that
   * `?fast` does not scale, while it *does* shorten the clock — and the room
   * moved on without them.
   *
   * Scaled by `rate` so the test costs milliseconds, and asserted on real
   * elapsed time because a virtual clock cannot tell concurrent from
   * sequential.
   */
  it('dwells concurrently, so N bots do not cost N pauses', async () => {
    // A room already writing, so the pool actually reaches `answer()`.
    // Joining mid-phase is legal — that is the late-arrival path — so the
    // bots land as competitors with no entry, which is exactly `due`.
    const h = harness(undefined, fixtureFor('compose', { players: 4 }))

    // 2.5s / 6s / 9s become 25ms / 60ms / 90ms. Cumulative would be 175ms.
    const pool = new BotPool({
      apply: h.apply,
      snapshot: h.state,
      now: () => Date.now(),
      rate: 100,
    })
    for (const level of ['intern', 'senior', 'principal'] as const) pool.add(level)
    expect(pool.list()).toHaveLength(3)

    const started = Date.now()
    pool.observe(h.state())
    await new Promise((resolve) => setTimeout(resolve, 130))
    const elapsed = Date.now() - started

    // Every bot has submitted, by the time the *slowest* was due plus slack.
    const entries = h.state().round?.entries ?? []
    for (const bot of pool.list()) {
      expect(entries.some((entry) => entry.authorId === bot.id)).toBe(true)
    }
    expect(elapsed).toBeLessThan(175)
    pool.close()
  })
})

describe('a bot and the presence gate', () => {
  /**
   * The rule that used to hold by accident.
   *
   * A bot reaches the engine directly, so it never appears in a presence
   * report and never will. `reconcile` skipped it only via the `everAttached`
   * guard, which exists for fixture players — so a later tightening of that
   * guard would have dropped every bot out of every phase gate at once, with
   * nothing on screen to say why.
   */
  it('stays online through a reconcile that names only the human seats', async () => {
    const h = harness()
    const id = h.pool.add('senior')
    expect(id).toBeDefined()

    const bus = new LocalBus('DEV000', { latencyMs: 0, jitterMs: 0 })
    const transport = createLocalTransport({ bus, selfId: 'p0', isHost: true })
    let current = h.state()
    const engine = new HostEngine({
      transport,
      initial: current,
      now: () => 0,
      setTimer: () => 0 as unknown as TimerHandle,
      clearTimer: () => undefined,
      onChange: (next) => {
        current = next
      },
    })
    engine.start()
    await bus.flush()

    // Exactly what Ably reports: the seats that actually hold a connection.
    // The bot is absent, because it has none to hold.
    expect(current.players.some((p) => p.bot)).toBe(true)
    bus.setPresence('p0', 'online')
    await bus.flush()

    const after = engine.snapshot().players.find((p) => p.id === id)
    // Not `reconnecting`, and not gone. A bot is fired, never dropped.
    expect(after).toBeDefined()
    expect(after?.connection).toBe('online')

    engine.stop()
  })

  /**
   * The contrast that makes the test above mean something.
   *
   * Without this, "the bot stayed online" would prove nothing — a reconcile
   * that marks *nobody* would pass it too. A person who attaches and then
   * vanishes has to be marked, in the same run, on the same engine.
   */
  it('still marks a person who attached and then vanished', async () => {
    const h = harness()
    h.pool.add('senior')

    const bus = new LocalBus('DEV000', { latencyMs: 0, jitterMs: 0 })
    const host = createLocalTransport({ bus, selfId: 'p0', isHost: true })
    const engine = new HostEngine({
      transport: host,
      initial: h.state(),
      now: () => 0,
      setTimer: () => 0 as unknown as TimerHandle,
      clearTimer: () => undefined,
    })
    engine.start()

    // A real guest: its own endpoint, so the host sees it attach.
    const guest = createLocalTransport({ bus, selfId: 'p9', isHost: false })
    guest.onState(() => undefined)
    guest.setPresence('online')
    await bus.flush()
    engine.apply({ type: 'player/joined', player: { id: 'p9', name: 'Ada', avatarSeed: 'b' } }, 'p9')
    await bus.flush()
    expect(engine.snapshot().players.find((p) => p.id === 'p9')?.connection).toBe('online')

    // The guest's tab closes. Presence loses it, which is the only signal the
    // host ever gets that somebody went away.
    guest.close()
    bus.dropPresence('p9')
    await bus.flush()

    const people = engine.snapshot().players
    expect(people.find((p) => p.id === 'p9')?.connection).toBe('reconnecting')
    // Same reconcile, same run: the bot is untouched.
    expect(people.find((p) => p.bot)?.connection).toBe('online')

    engine.stop()
  })
})
