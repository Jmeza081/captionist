import { describe, expect, it, vi } from 'vitest'
import { fixtureFor } from '@/lib/game/fixtures'
import type { PublicState } from '@/lib/game/types'
import { GuestClient } from './GuestClient'
import { HostEngine, type TimerHandle } from './HostEngine'
import { LocalBus, createLocalTransport } from './LocalTransport'
import type { Intent, RoomEvent } from './transport'

const noTimers = {
  setTimer: (): TimerHandle => 0 as unknown as TimerHandle,
  clearTimer: (): void => {},
}

function room(phase: Parameters<typeof fixtureFor>[0] = 'vote') {
  const bus = new LocalBus('C-F34213', { latencyMs: 0 })
  const hostTransport = createLocalTransport({ bus, selfId: 'p0', isHost: true })
  const refusals: Array<{ intent: Intent; reason: string }> = []
  const engine = new HostEngine({
    transport: hostTransport,
    initial: fixtureFor(phase, { players: 5 }),
    now: () => 1_700_000_000_000,
    ...noTimers,
    onRefused: (intent, reason) => refusals.push({ intent, reason }),
  })
  return { bus, engine, hostTransport, refusals }
}

describe('the transport boundary', () => {
  it('never delivers synchronously, even at zero latency', async () => {
    const bus = new LocalBus('C-F34213', { latencyMs: 0 })
    const host = createLocalTransport({ bus, selfId: 'p0', isHost: true })
    const seen = vi.fn()
    host.onIntent(seen)

    host.sendIntent({ type: 'game/started' })
    // The whole point: a screen must never be able to assume its send resolved
    // in the same tick, or it will never grow the pending state Ably needs.
    expect(seen).not.toHaveBeenCalled()

    await bus.flush()
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('tells the host why its own action was refused', async () => {
    // The path a real button takes: send over the transport, not into the
    // engine. `apply()` can only name a refusal when it can name the intent
    // that caused it, so this is the only route that produces a snackbar.
    const { bus, engine, hostTransport, refusals } = room('compose')
    engine.start()
    await bus.flush()

    // p0 holds round 1, and the role holder sits the round out.
    hostTransport.sendIntent({
      type: 'round/entrySubmitted',
      answer: { kind: 'caption', lines: ['nope'] },
    })
    await bus.flush()

    expect(refusals).toHaveLength(1)
    expect(refusals[0]?.intent.from).toBe('p0')
    expect(refusals[0]?.reason).toBe('You set this round up, so you sit it out.')
  })

  it('keeps a scaled room clock honest between broadcasts', async () => {
    // Under `?fast` the host's clock runs faster than the wall clock. A guest
    // holding only an offset falls behind the moment broadcasts stop, which is
    // exactly when a countdown is being read.
    const origin = 1_700_000_000_000
    let realNow = origin
    const bus = new LocalBus('C-F34213', { latencyMs: 0 })
    const hostTransport = createLocalTransport({ bus, selfId: 'p0', isHost: true })
    const engine = new HostEngine({
      transport: hostTransport,
      initial: fixtureFor('vote', { players: 5 }),
      now: () => realNow,
      fast: 10,
      ...noTimers,
    })
    const guestTransport = createLocalTransport({ bus, selfId: 'p1', isHost: false })
    const guest = new GuestClient({ transport: guestTransport, now: () => realNow })
    guest.start()
    engine.start()
    await bus.flush()

    realNow += 100
    // 100ms of real time is a full second of room time at 10x.
    expect(guest.roomNow()).toBe(origin + 1_000)
    expect(guest.roomNow()).toBe(engine.now())
  })

  it('strips authorship from other players while voting, and keeps your own', async () => {
    const { bus, engine } = room('vote')
    const guestTransport = createLocalTransport({ bus, selfId: 'p1', isHost: false })
    let received: PublicState | undefined
    const guest = new GuestClient({ transport: guestTransport, onState: (s) => { received = s } })
    guest.start()
    engine.start()
    await bus.flush()

    const entries = received?.round?.entries ?? []
    expect(entries.length).toBeGreaterThan(0)

    const mine = entries.filter((e) => e.authorId === 'p1')
    expect(mine).toHaveLength(1)
    // Everyone else's authorship is gone from the wire, not merely unrendered:
    // host authority means devtools would otherwise defeat anonymity.
    for (const entry of entries) {
      if (entry.id !== mine[0]?.id) expect(entry.authorId).toBeUndefined()
    }
  })

  it('gives authorship back at the reveal', async () => {
    const { bus, engine } = room('reveal')
    const guestTransport = createLocalTransport({ bus, selfId: 'p1', isHost: false })
    let received: PublicState | undefined
    new GuestClient({ transport: guestTransport, onState: (s) => { received = s } }).start()
    engine.start()
    await bus.flush()

    const entries = received?.round?.entries ?? []
    expect(entries.every((e) => e.authorId !== undefined)).toBe(true)
  })

  it('drops a stale revision and keeps the newer one', async () => {
    const bus = new LocalBus('C-F34213', { latencyMs: 0 })
    const host = createLocalTransport({ bus, selfId: 'p0', isHost: true })
    const guestTransport = createLocalTransport({ bus, selfId: 'p1', isHost: false })

    const seen: number[] = []
    new GuestClient({ transport: guestTransport, onState: (s) => seen.push(s.rev) }).start()

    const at = (rev: number) => ({ ...fixtureFor('lobby'), rev })
    const send = async (rev: number) => {
      host.publishState(at(rev), { rev, hostNow: 1_700_000_000_000 }, 'p1')
      await bus.flush()
    }

    await send(5)
    await send(4) // late delivery of an older revision
    await send(6)

    // 4 never reaches the screen: `rev` is the ordering token, so an
    // out-of-order arrival is a non-event rather than a visible flicker.
    expect(seen).toEqual([5, 6])
  })

  it('measures clock skew from the host rather than trusting local time', async () => {
    const bus = new LocalBus('C-F34213', { latencyMs: 0 })
    const host = createLocalTransport({ bus, selfId: 'p0', isHost: true })
    const guestTransport = createLocalTransport({ bus, selfId: 'p1', isHost: false })

    // This guest's clock is a full minute behind the host's.
    const guest = new GuestClient({ transport: guestTransport, now: () => 1_000_000 })
    guest.start()

    host.publishState(fixtureFor('lobby'), { rev: 2, hostNow: 1_060_000 }, 'p1')
    await bus.flush()

    expect(guest.roomNow()).toBe(1_060_000)
  })

  it('delivers to every subscriber on the same endpoint', async () => {
    const bus = new LocalBus('C-F34213', { latencyMs: 0 })
    const host = createLocalTransport({ bus, selfId: 'p0', isHost: true })

    // The host really does subscribe twice: once to feed the store, once to
    // drive the autopilot. Keying one handler per endpoint silently evicted
    // the first, which looks exactly like a room that runs but never renders.
    const toStore = vi.fn()
    const toAutopilot = vi.fn()
    host.onState(toStore)
    const offAutopilot = host.onState(toAutopilot)

    host.publishState(fixtureFor('lobby'), { rev: 2, hostNow: 0 }, 'p0')
    await bus.flush()
    expect(toStore).toHaveBeenCalledTimes(1)
    expect(toAutopilot).toHaveBeenCalledTimes(1)

    // And unsubscribing one must not take the other with it.
    offAutopilot()
    host.publishState(fixtureFor('lobby'), { rev: 3, hostNow: 0 }, 'p0')
    await bus.flush()
    expect(toStore).toHaveBeenCalledTimes(2)
    expect(toAutopilot).toHaveBeenCalledTimes(1)
  })

  it('refuses a guest trying to end the phase early', async () => {
    const { bus, engine, refusals } = room('compose')
    const guestTransport = createLocalTransport({ bus, selfId: 'p1', isHost: false })
    engine.start()
    await bus.flush()

    const before = engine.snapshot()
    guestTransport.sendIntent({ type: 'clock/expired', phase: 'compose' })
    await bus.flush()

    expect(engine.snapshot()).toBe(before)
    expect(refusals.at(-1)?.reason).toMatch(/clock/i)
  })

  it('refuses a guest taking a host-only action', async () => {
    const { bus, engine, refusals } = room('lobby')
    const guestTransport = createLocalTransport({ bus, selfId: 'p1', isHost: false })
    engine.start()
    await bus.flush()

    guestTransport.sendIntent({ type: 'game/started' })
    await bus.flush()

    expect(engine.snapshot().phase).toBe('lobby')
    expect(refusals.at(-1)?.reason).toBe('Only the host can do that.')
  })

  it('refuses to let a guest broadcast state', () => {
    const bus = new LocalBus('C-F34213', { latencyMs: 0 })
    const guest = createLocalTransport({ bus, selfId: 'p1', isHost: false })
    expect(() =>
      guest.publishState(fixtureFor('lobby'), { rev: 2, hostNow: 0 }),
    ).toThrow(/only the host/i)
  })
})

describe('a refusal for someone else', () => {
  it('travels the transport, because an in-process callback reaches one tab', async () => {
    const { bus, engine } = room('lobby')
    engine.start()

    // A real guest: its own endpoint, its own seat, as it would be in its own
    // tab once `BroadcastTransport` puts it there.
    const guest = createLocalTransport({ bus, selfId: 'p1', isHost: false })
    const heard: string[] = []
    guest.onRefusal((reason) => heard.push(reason))

    // Host-only, so the room says no.
    guest.sendIntent({ type: 'game/started' })
    await bus.flush()

    expect(heard).toEqual(['Only the host can do that.'])
  })

  it('does not send the host its own refusals over the wire', async () => {
    const { bus, engine, hostTransport, refusals } = room('lobby')
    engine.start()

    const heard: string[] = []
    hostTransport.onRefusal((reason) => heard.push(reason))

    // `game/started` needs three players; this fixture's lobby has five, so
    // reach for something the host genuinely cannot do instead.
    hostTransport.sendIntent({ type: 'round/ballotCast', ballot: { kind: 'rank', ranked: [] } })
    await bus.flush()

    // The host is in the room where the refusal was decided: it hears it
    // through the engine's own callback, and putting it on the wire as well
    // would show it twice.
    expect(refusals).toHaveLength(1)
    expect(heard).toEqual([])
  })
})

describe('the event lane', () => {
  it('stamps the sender rather than trusting the payload', async () => {
    const bus = new LocalBus('C-F34213', { latencyMs: 0 })
    const host = createLocalTransport({ bus, selfId: 'p0', isHost: true })
    const guest = createLocalTransport({ bus, selfId: 'p1', isHost: false })

    const heard: RoomEvent[] = []
    host.onEvent((event) => heard.push(event))

    // A guest addressing a message from the host. `from` is the transport's to
    // decide, exactly as `Intent.from` is — without that, the first thing chat
    // buys the room is the ability to post as anybody in it.
    guest.publishEvent({ kind: 'chat', from: 'p0', text: 'everyone vote for mine', at: 0 })
    await bus.flush()

    expect(heard).toHaveLength(1)
    expect(heard[0]?.from).toBe('p1')
  })

  it('reaches the room without touching its state', async () => {
    const { bus, engine, hostTransport } = room('vote')
    engine.start()

    const guest = createLocalTransport({ bus, selfId: 'p1', isHost: false })
    const heard: RoomEvent[] = []
    hostTransport.onEvent((event) => heard.push(event))

    // Read after the guest has attached: joining the room is a real change,
    // and the claim under test is about the event, not the connection.
    await bus.flush()
    const before = engine.snapshot().rev

    guest.publishEvent({
      kind: 'reaction',
      from: 'p1',
      target: 'entry',
      targetId: 'e1',
      emoji: '🔥',
      at: 0,
    })
    await bus.flush()

    expect(heard).toHaveLength(1)
    // The whole reason chat is an event: it must not bump the revision guests
    // drop stale *game* updates against.
    expect(engine.snapshot().rev).toBe(before)
  })
})
