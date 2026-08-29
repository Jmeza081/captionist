import type { ActionInput } from '@/lib/game/actions'
import type { ConnectionState, PlayerId, PublicState, RoomCode } from '@/lib/game/types'
import type {
  Intent,
  PresenceEntry,
  RoomEvent,
  RoomTransport,
  StateMeta,
  TransportStatus,
} from './transport'

/**
 * A room across browser tabs, over `BroadcastChannel`.
 *
 * The second implementation of `RoomTransport`, and the first with a real
 * serialisation boundary — messages are structured-cloned between contexts
 * rather than handed over as live objects. That is the point of building it
 * before Ably: everything that breaks when state has to survive a copy breaks
 * here, where it is cheap to see.
 *
 * Three things it must do that `LocalTransport` does not:
 *
 * 1. **Loop the sender back itself.** `BroadcastChannel` never delivers a
 *    message to the object that posted it, and the host's own actions travel
 *    the transport by design (ADR 0004). Every send therefore also runs a local
 *    delivery — deferred, never synchronous, for the same reason `LocalBus`
 *    defers even at zero latency.
 * 2. **Address state per recipient.** `project()` is per viewer, so state goes
 *    out on one channel *per player* rather than a shared broadcast with a `to`
 *    field. A shared payload would put every other player's authorship into
 *    every tab's message handler, which is the leak ADR 0003 says devtools
 *    would otherwise defeat.
 * 3. **Decide who is hosting.** Nothing above this layer knows whether a room
 *    already exists. `connectBroadcast` probes, and the answer is the returned
 *    transport's `isHost`.
 *
 * **Same-origin tabs are not a security boundary.** The membership token below
 * stops a stray script stamping itself as someone else, which keeps
 * `Intent.from` meaning what its doc comment says. It is not protection against
 * a determined user of their own browser, and it does not pretend to be — real
 * enforcement arrives with Ably, where the server issues the identity.
 */

/* ------------------------------------------------------------------ */
/* Wire format                                                         */
/* ------------------------------------------------------------------ */

type Wire =
  /** "Is anyone hosting this code?" — sent once, on connect. */
  | { t: 'claim'; from: PlayerId }
  /** The host answering a claim, and handing the asker its membership token. */
  | { t: 'held'; host: PlayerId; to: PlayerId; token: string }
  /** Still here. Both directions: a silent host is a lost room. */
  | { t: 'beat'; from: PlayerId; token: string; host: boolean }
  /**
   * "I am listening now — say something."
   *
   * The host seats a guest the moment it answers a claim, and publishing to
   * that seat is what prompts the guest to ask for a place in the room. But the
   * guest's inbox does not exist until it has finished connecting, so that first
   * broadcast lands on a channel nobody is holding and the guest waits forever
   * on a room that thinks it already spoke. Re-asked on every heartbeat until
   * state actually arrives, which makes it self-healing rather than a race won
   * by luck.
   */
  | { t: 'sync'; from: PlayerId; token: string }
  /** Leaving cleanly, so the roster does not wait out a timeout. */
  | { t: 'bye'; from: PlayerId; token: string }
  | { t: 'intent'; from: PlayerId; token: string; action: ActionInput }
  /**
   * Chat and reactions, peer to peer.
   *
   * Carries `from` and `token` for the same reason an intent does — so a stray
   * script cannot stamp itself as somebody else. Only the host holds the
   * roster, so only the host can check the token; a guest takes `from` at its
   * word and the event store drops anyone who is not in the room. That is the
   * boundary this file already declares at the top: real enforcement is Ably's,
   * where the identity is issued by a server rather than asserted by a tab.
   */
  | { t: 'event'; from: PlayerId; token: string; event: RoomEvent }
  | { t: 'refusal'; to: PlayerId; reason: string }
  | { t: 'presence'; entries: readonly PresenceEntry[] }

/**
 * Whether this endpoint is willing to host.
 *
 * `auto` is what a real room uses: ask, and take the room if nobody answers.
 * The other two exist because one tab can hold several endpoints — the dev
 * harness runs a host, its bots and (under `?as=`) a second seat, all in one
 * page — and those endpoints already know which they are.
 */
export type BroadcastRole = 'auto' | 'host' | 'guest'

export interface BroadcastOptions {
  roomCode: RoomCode
  selfId: PlayerId
  role?: BroadcastRole
  /** How long to wait for a host to answer a claim. */
  probeMs?: number
  /** How often to announce we are still here. */
  beatMs?: number
  /** Silence beyond this drops a member, or marks the host lost. */
  timeoutMs?: number
}

/** Long enough for a busy tab to answer, short enough not to look broken. */
const PROBE_MS = 180
const BEAT_MS = 1_500
const TIMEOUT_MS = 5_000

function channelName(roomCode: RoomCode): string {
  return `captionist:${roomCode}`
}

function stateChannelName(roomCode: RoomCode, id: PlayerId): string {
  return `captionist:${roomCode}:state:${id}`
}

function freshToken(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Deferred, always — see `LocalBus.deliver` for why this is never synchronous. */
function defer(run: () => void): void {
  queueMicrotask(run)
}

/* ------------------------------------------------------------------ */
/* Connect                                                             */
/* ------------------------------------------------------------------ */

/**
 * Join the room at `roomCode`, or become its host if nobody answers.
 *
 * Resolves once the question is settled, which is why it is async: every
 * caller above needs the answer before it can decide whether to build an
 * engine. The wait is one `probeMs` at worst, and it is not dead time: this
 * *is* the boot screen's first step, and it reports as `claiming`.
 */
export async function connectBroadcast(options: BroadcastOptions): Promise<RoomTransport> {
  const { roomCode, selfId } = options
  const role = options.role ?? 'auto'
  const probeMs = options.probeMs ?? PROBE_MS
  const control = new BroadcastChannel(channelName(roomCode))

  // A declared host does not ask. The dev harness boots a fixture that *is* the
  // room, so probing could only ever hand it away to a stale tab.
  if (role === 'host') return build(control, options, { isHost: true, token: freshToken() })

  const decision = await probe(control, roomCode, selfId, probeMs, role)
  return build(control, options, decision)
}

interface Decision {
  isHost: boolean
  /** The token the host issued us. The host mints its own. */
  token: string
}

/**
 * Ask, and wait.
 *
 * The tie is the interesting case: two tabs opening the same code at once both
 * hear silence and both would host. So a claim seen *during our own probe* is
 * recorded, and the lowest id wins — deterministic, needs no second round trip,
 * and both tabs reach the same answer from the same facts.
 */
function probe(
  control: BroadcastChannel,
  roomCode: RoomCode,
  selfId: PlayerId,
  probeMs: number,
  role: BroadcastRole,
): Promise<Decision> {
  return new Promise((resolve) => {
    let settled = false
    let attempts = 0
    const rivals: PlayerId[] = []

    const finish = (decision: Decision) => {
      if (settled) return
      settled = true
      control.removeEventListener('message', listener)
      clearTimeout(timer)
      resolve(decision)
    }

    function listener(message: MessageEvent<Wire>) {
      const wire = message.data
      if (wire.t === 'held' && wire.to === selfId) {
        finish({ isHost: false, token: wire.token })
        return
      }
      // Another tab opened the same code in the same window as us.
      if (wire.t === 'claim' && wire.from !== selfId) rivals.push(wire.from)
    }

    const ask = () => {
      attempts += 1
      control.postMessage({ t: 'claim', from: selfId } satisfies Wire)
      timer = setTimeout(settle, probeMs)
    }

    const settle = () => {
      if (settled) return
      // A declared guest never promotes itself. The host it is waiting for is
      // in the same tab and may simply not have attached yet, so it asks again
      // rather than giving up and starting a second room.
      if (role === 'guest') {
        if (attempts < 20) {
          control.postMessage({ t: 'claim', from: selfId } satisfies Wire)
          attempts += 1
          timer = setTimeout(settle, probeMs)
          return
        }
        finish({ isHost: false, token: freshToken() })
        return
      }
      // Silence means the room is ours — unless a rival claimed alongside us,
      // in which case the lowest id takes it. Both tabs see the same claims and
      // reach the same answer, so no second round trip is needed.
      finish({ isHost: !rivals.some((id) => id < selfId), token: freshToken() })
    }

    let timer: ReturnType<typeof setTimeout>
    control.addEventListener('message', listener)
    ask()
  })
}

/* ------------------------------------------------------------------ */
/* The transport                                                       */
/* ------------------------------------------------------------------ */

function build(
  control: BroadcastChannel,
  options: BroadcastOptions,
  decision: Decision,
): RoomTransport {
  const { roomCode, selfId } = options
  const beatMs = options.beatMs ?? BEAT_MS
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS
  const { isHost } = decision
  let token = decision.token

  const intentHandlers = new Set<(intent: Intent) => void>()
  const stateHandlers = new Set<(state: PublicState, meta: StateMeta) => void>()
  const eventHandlers = new Set<(event: RoomEvent) => void>()
  const presenceHandlers = new Set<(entries: readonly PresenceEntry[]) => void>()
  const refusalHandlers = new Set<(reason: string) => void>()
  const statusHandlers = new Set<(status: TransportStatus) => void>()

  /** Host only: who is attached, their token, and when we last heard from them. */
  const roster = new Map<PlayerId, { token: string; seen: number }>()
  /** Host only: one outbound channel per recipient, opened lazily. */
  const stateOut = new Map<PlayerId, BroadcastChannel>()

  /** Our own inbox. The host has one too — it is a recipient like any other. */
  const stateIn = new BroadcastChannel(stateChannelName(roomCode, selfId))

  let presence: ConnectionState = 'online'
  /** Has the host ever spoken to us? Until it has, we keep asking. */
  let synced = isHost
  let lastHostBeat = Date.now()
  let status: TransportStatus = 'connecting'
  let closed = false

  const setStatus = (next: TransportStatus) => {
    if (closed || status === next) return
    status = next
    for (const handler of [...statusHandlers]) handler(next)
  }

  const post = (wire: Wire) => {
    if (closed) return
    control.postMessage(wire)
  }

  /* ---------------- inbound: state ---------------- */

  stateIn.addEventListener('message', (message: MessageEvent<{ state: PublicState; meta: StateMeta }>) => {
    if (closed) return
    synced = true
    lastHostBeat = Date.now()
    setStatus('connected')
    const { state, meta } = message.data
    for (const handler of [...stateHandlers]) handler(state, meta)
  })

  /* ---------------- inbound: control ---------------- */

  const onControl = (message: MessageEvent<Wire>) => {
    if (closed) return
    const wire = message.data

    switch (wire.t) {
      case 'claim': {
        if (!isHost) return
        // Someone new. Issue a token, seat them in the roster, and answer.
        const issued = freshToken()
        roster.set(wire.from, { token: issued, seen: Date.now() })
        post({ t: 'held', host: selfId, to: wire.from, token: issued })
        announcePresence()
        return
      }

      case 'held': {
        // A late `held` for us — we already resolved, but the token is current.
        if (wire.to === selfId) token = wire.token
        if (!isHost) {
          lastHostBeat = Date.now()
          setStatus('connected')
        }
        return
      }

      case 'beat': {
        if (wire.host) {
          if (!isHost) {
            lastHostBeat = Date.now()
            setStatus('connected')
          }
          return
        }
        if (!isHost) return
        const seat = roster.get(wire.from)
        // An unknown or mismatched beat is not a member. Silence is the answer:
        // a reply would tell a forger which ids exist.
        if (!seat || seat.token !== wire.token) return
        seat.seen = Date.now()
        return
      }

      case 'sync': {
        if (!isHost) return
        const seat = roster.get(wire.from)
        if (!seat || seat.token !== wire.token) return
        seat.seen = Date.now()
        // The engine listens to presence and republishes; a repeat costs
        // nothing, because guests drop any rev they already hold.
        announcePresence()
        return
      }

      case 'bye': {
        if (!isHost) return
        const seat = roster.get(wire.from)
        if (!seat || seat.token !== wire.token) return
        roster.delete(wire.from)
        stateOut.get(wire.from)?.close()
        stateOut.delete(wire.from)
        announcePresence()
        return
      }

      case 'intent': {
        if (!isHost) return
        const seat = roster.get(wire.from)
        // The trust boundary this transport exists to hold: `Intent.from` is
        // only meaningful if a sender cannot claim to be somebody else.
        if (!seat || seat.token !== wire.token) return
        seat.seen = Date.now()
        for (const handler of [...intentHandlers]) handler({ from: wire.from, action: wire.action })
        return
      }

      case 'event': {
        // The host is the only endpoint that can tell a member from a forgery,
        // so it is the only one that refuses. A guest cannot, and pretending
        // otherwise would be theatre.
        if (isHost) {
          const seat = roster.get(wire.from)
          if (!seat || seat.token !== wire.token) return
        }
        // `from` is the transport's, never the payload's — same rule the
        // intent lane holds, so a caller cannot address a message from anyone.
        for (const handler of [...eventHandlers]) handler({ ...wire.event, from: wire.from })
        return
      }

      case 'refusal': {
        if (wire.to !== selfId) return
        for (const handler of [...refusalHandlers]) handler(wire.reason)
        return
      }

      case 'presence': {
        if (isHost) return
        for (const handler of [...presenceHandlers]) handler(wire.entries)
        return
      }
    }
  }

  control.addEventListener('message', onControl)

  /* ---------------- presence ---------------- */

  function entries(): readonly PresenceEntry[] {
    const list: PresenceEntry[] = [{ id: selfId, state: presence }]
    for (const id of roster.keys()) list.push({ id, state: 'online' })
    return list
  }

  function announcePresence(): void {
    if (!isHost) return
    const snapshot = entries()
    post({ t: 'presence', entries: snapshot })
    defer(() => {
      for (const handler of [...presenceHandlers]) handler(snapshot)
    })
  }

  /* ---------------- heartbeat ---------------- */

  const beat = setInterval(() => {
    if (closed) return
    post({ t: 'beat', from: selfId, token, host: isHost })
    // Keep asking until the room answers. The first publish after a claim can
    // land before this endpoint's inbox exists, and a guest with no state has
    // nothing to render and no way to ask for a seat.
    if (!synced) post({ t: 'sync', from: selfId, token })

    if (isHost) {
      // Expire anyone we have stopped hearing from. Their seat in `GameState`
      // is the reducer's business; this is only who to address state to.
      let dropped = false
      const cutoff = Date.now() - timeoutMs
      for (const [id, seat] of [...roster]) {
        if (seat.seen >= cutoff) continue
        roster.delete(id)
        stateOut.get(id)?.close()
        stateOut.delete(id)
        dropped = true
      }
      if (dropped) announcePresence()
      return
    }

    if (Date.now() - lastHostBeat > timeoutMs) setStatus('disconnected')
  }, beatMs)

  /* ---------------- the interface ---------------- */

  const transport: RoomTransport = {
    roomCode,
    selfId,
    isHost,

    sendIntent(action: ActionInput) {
      if (isHost) {
        // The host's own actions travel the transport too (ADR 0004), but a
        // channel will not hand a message back to its sender.
        defer(() => {
          for (const handler of [...intentHandlers]) handler({ from: selfId, action })
        })
        return
      }
      post({ t: 'intent', from: selfId, token, action })
    },

    onIntent(handler) {
      if (!isHost) return () => {}
      intentHandlers.add(handler)
      return () => intentHandlers.delete(handler)
    },

    publishState(state, meta, to) {
      if (!isHost) throw new Error('publishState: only the host may broadcast state')
      const targets = to !== undefined ? [to] : [selfId, ...roster.keys()]
      for (const id of targets) {
        if (id === selfId) {
          defer(() => {
            for (const handler of [...stateHandlers]) handler(state, meta)
          })
          continue
        }
        let out = stateOut.get(id)
        if (!out) {
          out = new BroadcastChannel(stateChannelName(roomCode, id))
          stateOut.set(id, out)
        }
        out.postMessage({ state, meta })
      }
    },

    onState(handler) {
      stateHandlers.add(handler)
      return () => stateHandlers.delete(handler)
    },

    publishEvent(event) {
      const stamped = { ...event, from: selfId }
      post({ t: 'event', from: selfId, token, event: stamped })
      defer(() => {
        for (const handler of [...eventHandlers]) handler(stamped)
      })
    },

    onEvent(handler) {
      eventHandlers.add(handler)
      return () => eventHandlers.delete(handler)
    },

    publishRefusal(to, reason) {
      if (!isHost) throw new Error('publishRefusal: only the host may refuse an intent')
      post({ t: 'refusal', to, reason })
    },

    onRefusal(handler) {
      refusalHandlers.add(handler)
      return () => refusalHandlers.delete(handler)
    },

    setPresence(state) {
      presence = state
      announcePresence()
    },

    onPresence(handler) {
      presenceHandlers.add(handler)
      return () => presenceHandlers.delete(handler)
    },

    members() {
      return [selfId, ...roster.keys()]
    },

    onStatus(handler) {
      statusHandlers.add(handler)
      // A host is connected the moment it decides it is one; a guest is
      // connected as soon as it hears anything. Deferred so a subscriber that
      // binds in the same tick still receives it.
      if (isHost) defer(() => handler('connected'))
      return () => statusHandlers.delete(handler)
    },

    close() {
      if (closed) return
      closed = true
      clearInterval(beat)
      if (!isHost) post({ t: 'bye', from: selfId, token })
      control.removeEventListener('message', onControl)
      control.close()
      stateIn.close()
      for (const out of stateOut.values()) out.close()
      stateOut.clear()
      roster.clear()
      intentHandlers.clear()
      stateHandlers.clear()
      eventHandlers.clear()
      presenceHandlers.clear()
      refusalHandlers.clear()
      statusHandlers.clear()
    },
  }

  if (isHost) setStatus('connected')
  // Deferred: the host's control listener is attached synchronously above, but
  // this endpoint's own listeners are not bound until the caller subscribes.
  else defer(() => post({ t: 'sync', from: selfId, token }))
  return transport
}
