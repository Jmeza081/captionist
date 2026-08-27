import type { ActionInput } from '@/lib/game/actions'
import type { ConnectionState, PlayerId, PublicState, RoomCode } from '@/lib/game/types'
import type {
  Intent,
  PresenceEntry,
  RoomEvent,
  RoomTransport,
  StateMeta,
  TransportStatus,
  Unsubscribe,
} from './transport'

/**
 * An in-memory room, for one browser tab.
 *
 * Every endpoint — the host and any bots — attaches to a shared `LocalBus`.
 * There is no network, no serialisation and no other tab. That makes it the
 * right thing to build screens against, and the wrong thing to trust: see the
 * deliberate latency below, and `BroadcastTransport` in phase 4 for the first
 * implementation with a real serialisation boundary.
 */

/**
 * Delivery is *always* deferred, never synchronous.
 *
 * A synchronous local transport is the trap this whole approach exists to
 * avoid: if a guest's send resolves in the same tick, no screen ever needs a
 * pending state, and every submit path gets rewritten the day Ably lands.
 * ~80ms with jitter approximates a real room; `latencyMs: 0` still defers to a
 * microtask, so tests stay deterministic without ever being instantaneous.
 */
export interface LocalBusOptions {
  /** Mean one-way delay. Defaults to 80ms; pass 0 in tests. */
  latencyMs?: number
  /** Uniform ± spread around `latencyMs`. Ignored when latency is 0. */
  jitterMs?: number
  /** Injectable so a test can make delivery order deterministic. */
  random?: () => number
}

type Envelope = () => void

export class LocalBus {
  readonly roomCode: RoomCode
  private readonly latencyMs: number
  private readonly jitterMs: number
  private readonly random: () => number

  /**
   * A *set* of handlers per endpoint, not one.
   *
   * One handler per id looks sufficient — each endpoint has a client — and is
   * silently wrong: the host subscribes twice, once to feed the store and once
   * to drive the autopilot, and a plain `Map.set` makes the second eviction of
   * the first look like a working room that never renders. `onState` hands back
   * an unsubscribe, so it has to mean what it says.
   */
  private readonly intentHandlers = new Map<PlayerId, Set<(intent: Intent) => void>>()
  private readonly stateHandlers = new Map<
    PlayerId,
    Set<(state: PublicState, meta: StateMeta) => void>
  >()
  private readonly eventHandlers = new Map<PlayerId, Set<(event: RoomEvent) => void>>()
  private readonly presenceHandlers = new Map<
    PlayerId,
    Set<(entries: readonly PresenceEntry[]) => void>
  >()
  private readonly presence = new Map<PlayerId, ConnectionState>()

  /** Outstanding deliveries, so `flush()` can await a quiet bus. */
  private pending = 0
  private idle: Array<() => void> = []
  private closed = false

  constructor(roomCode: RoomCode, options: LocalBusOptions = {}) {
    this.roomCode = roomCode
    this.latencyMs = options.latencyMs ?? 80
    this.jitterMs = options.jitterMs ?? 40
    this.random = options.random ?? Math.random
  }

  private deliver(envelope: Envelope): void {
    if (this.closed) return
    this.pending += 1
    const run = () => {
      this.pending -= 1
      if (!this.closed) envelope()
      if (this.pending === 0) {
        const waiters = this.idle
        this.idle = []
        for (const resolve of waiters) resolve()
      }
    }
    if (this.latencyMs <= 0) {
      queueMicrotask(run)
      return
    }
    const spread = this.jitterMs * (this.random() * 2 - 1)
    setTimeout(run, Math.max(0, this.latencyMs + spread))
  }

  /** Resolves once every in-flight delivery has run. Test affordance. */
  flush(): Promise<void> {
    if (this.pending === 0) return Promise.resolve()
    return new Promise((resolve) => this.idle.push(resolve))
  }

  private static add<H>(map: Map<PlayerId, Set<H>>, id: PlayerId, handler: H): Unsubscribe {
    const set = map.get(id) ?? new Set<H>()
    set.add(handler)
    map.set(id, set)
    return () => {
      const current = map.get(id)
      if (!current) return
      current.delete(handler)
      if (current.size === 0) map.delete(id)
    }
  }

  registerIntent(id: PlayerId, handler: (intent: Intent) => void): Unsubscribe {
    return LocalBus.add(this.intentHandlers, id, handler)
  }

  registerState(
    id: PlayerId,
    handler: (state: PublicState, meta: StateMeta) => void,
  ): Unsubscribe {
    return LocalBus.add(this.stateHandlers, id, handler)
  }

  registerEvent(id: PlayerId, handler: (event: RoomEvent) => void): Unsubscribe {
    return LocalBus.add(this.eventHandlers, id, handler)
  }

  registerPresence(
    id: PlayerId,
    handler: (entries: readonly PresenceEntry[]) => void,
  ): Unsubscribe {
    return LocalBus.add(this.presenceHandlers, id, handler)
  }

  sendIntent(intent: Intent): void {
    this.deliver(() => {
      for (const set of [...this.intentHandlers.values()]) {
        for (const handler of [...set]) handler(intent)
      }
    })
  }

  publishState(state: PublicState, meta: StateMeta, to?: PlayerId): void {
    const targets =
      to !== undefined
        ? [this.stateHandlers.get(to)].filter((set) => set !== undefined)
        : [...this.stateHandlers.values()]
    for (const set of targets) {
      for (const handler of [...set]) this.deliver(() => handler(state, meta))
    }
  }

  publishEvent(event: RoomEvent): void {
    this.deliver(() => {
      for (const set of [...this.eventHandlers.values()]) {
        for (const handler of [...set]) handler(event)
      }
    })
  }

  setPresence(id: PlayerId, state: ConnectionState): void {
    this.presence.set(id, state)
    const entries: readonly PresenceEntry[] = [...this.presence].map(([pid, s]) => ({
      id: pid,
      state: s,
    }))
    this.deliver(() => {
      for (const set of [...this.presenceHandlers.values()]) {
        for (const handler of [...set]) handler(entries)
      }
    })
  }

  /** Ids currently attached — the host's roster of who to address state to. */
  members(): readonly PlayerId[] {
    return [...this.stateHandlers.keys()]
  }

  close(): void {
    this.closed = true
    this.intentHandlers.clear()
    this.stateHandlers.clear()
    this.eventHandlers.clear()
    this.presenceHandlers.clear()
    const waiters = this.idle
    this.idle = []
    for (const resolve of waiters) resolve()
  }
}

export interface LocalTransportOptions {
  bus: LocalBus
  selfId: PlayerId
  isHost: boolean
}

const NOOP: Unsubscribe = () => {}

export function createLocalTransport(options: LocalTransportOptions): RoomTransport {
  const { bus, selfId, isHost } = options
  let statusHandler: ((status: TransportStatus) => void) | undefined
  const teardown: Unsubscribe[] = []

  // Local delivery cannot fail, so status goes straight to connected. The hook
  // exists because a guest screen binds to it and must not care which
  // implementation it got.
  queueMicrotask(() => statusHandler?.('connected'))

  const transport: RoomTransport = {
    roomCode: bus.roomCode,
    selfId,
    isHost,

    sendIntent(action: ActionInput) {
      bus.sendIntent({ from: selfId, action })
    },

    onIntent(handler) {
      // Guests never receive intents. Returning a no-op rather than throwing
      // means a caller can bind unconditionally.
      if (!isHost) return NOOP
      const off = bus.registerIntent(selfId, handler)
      teardown.push(off)
      return off
    },

    publishState(state, meta, to) {
      if (!isHost) throw new Error('publishState: only the host may broadcast state')
      bus.publishState(state, meta, to)
    },

    onState(handler) {
      const off = bus.registerState(selfId, handler)
      teardown.push(off)
      return off
    },

    publishEvent(event) {
      bus.publishEvent(event)
    },

    onEvent(handler) {
      const off = bus.registerEvent(selfId, handler)
      teardown.push(off)
      return off
    },

    setPresence(state) {
      bus.setPresence(selfId, state)
    },

    onPresence(handler) {
      const off = bus.registerPresence(selfId, handler)
      teardown.push(off)
      return off
    },

    members() {
      return bus.members()
    },

    onStatus(handler) {
      statusHandler = handler
      return () => {
        statusHandler = undefined
      }
    },

    close() {
      for (const off of teardown.splice(0)) off()
      statusHandler = undefined
    },
  }

  return transport
}
