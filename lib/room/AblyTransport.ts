'use client'

import * as Ably from 'ably'
import type { ActionInput } from '@/lib/game/actions'
import type { ConnectionState, PlayerId, PublicState, RoomCode } from '@/lib/game/types'
import type { BroadcastRole } from './BroadcastTransport'
import { readSeatSignature } from './identity'
import type {
  Intent,
  PresenceEntry,
  RoomEvent,
  RoomTransport,
  StateMeta,
  TransportStatus,
} from './transport'

/**
 * A room across devices, over Ably.
 *
 * The third implementation of `RoomTransport`, and the one the interface was
 * shaped for. **Nothing above `useRoom()` changes to accommodate it** — that
 * claim, made in [ADR 0003](../../docs/adr/0003-host-authority-over-a-swappable-transport.md)
 * before any screen existed, is what this file either proves or refutes.
 *
 * Three things it gets for free that `BroadcastTransport` had to build:
 *
 * 1. **`Intent.from` is trustworthy.** A token minted with a `clientId` binds
 *    it, and Ably rejects a publish claiming another. The membership-token
 *    table the tab transport needed is gone — provided `/api/ably/token` never
 *    takes a `clientId` on trust, which is why seats are signed there.
 * 2. **Presence is real.** Ably tracks it, so who is here stops being a thing
 *    we infer from heartbeats — and it carries per-member data, which is what
 *    lets `ConnectionState` finally mean something on the wire.
 * 3. **Reconnection is the SDK's.** A dropped socket retries on its own and
 *    resumes with message continuity for two minutes; past that, continuity is
 *    lost and the host has to republish.
 *
 * And one it has to be careful about: `echoMessages` defaults to **true**, so a
 * publisher receives its own messages back. The host's own loopback is explicit
 * here (ADR 0004), so an echo would apply every host action twice.
 */

/* ------------------------------------------------------------------ */
/* Wire format                                                         */
/* ------------------------------------------------------------------ */

/** Message names on the room's control channel. */
const INTENT = 'intent'
const EVENT = 'event'
const REFUSAL = 'refusal'

interface IntentBody {
  action: ActionInput
}

interface RefusalBody {
  to: PlayerId
  reason: string
}

/** What a member publishes about itself into presence. */
interface PresenceData {
  host: boolean
  state: ConnectionState
}

export interface AblyOptions {
  roomCode: RoomCode
  selfId: PlayerId
  role?: BroadcastRole
  /** Where to fetch a token. Injectable so a test can point it elsewhere. */
  authUrl?: string
  /** How long to let a contested election settle before trusting it. */
  settleMs?: number
}

/**
 * Long enough for two clients that entered presence at the same instant to see
 * each other, short enough that a host waits less than the round opener.
 */
const SETTLE_MS = 400

function controlChannel(roomCode: RoomCode): string {
  return `captionist:${roomCode}:control`
}

function stateChannel(roomCode: RoomCode, id: PlayerId): string {
  return `captionist:${roomCode}:state:${id}`
}

/**
 * Ably has eight connection states; the room needs three.
 *
 * `suspended` counts as disconnected rather than connecting: it means the
 * client has been down for over two minutes, queued messages have been
 * dropped, and the player needs telling.
 */
function toStatus(state: Ably.ConnectionState): TransportStatus {
  if (state === 'connected') return 'connected'
  if (state === 'initialized' || state === 'connecting') return 'connecting'
  return 'disconnected'
}

/* ------------------------------------------------------------------ */
/* Connect                                                             */
/* ------------------------------------------------------------------ */

export async function connectAbly(options: AblyOptions): Promise<RoomTransport> {
  const { roomCode, selfId } = options
  const role = options.role ?? 'auto'
  const settleMs = options.settleMs ?? SETTLE_MS
  const authUrl = options.authUrl ?? `/api/ably/token?room=${encodeURIComponent(roomCode)}`

  // Both halves, or the route cannot tell a returning player from someone
  // claiming their id — and mints a fresh seat instead. The token would then
  // bind an id this client never declared, and Ably refuses that mismatch
  // outright (40102). Sending the seat without its signature was exactly that
  // bug, invisible while every test ran on the tab transport.
  const signature = readSeatSignature()
  const client = new Ably.Realtime({
    authUrl,
    authParams: signature ? { seat: selfId, sig: signature } : { seat: selfId },
    clientId: selfId,
    // The host's own actions travel the transport by design, but they are
    // looped back locally — an echo would apply each of them twice.
    echoMessages: false,
  })

  await client.connection.once('connected')

  const control = client.channels.get(controlChannel(roomCode))
  const inbox = client.channels.get(stateChannel(roomCode, selfId))

  const isHost = await elect(control, selfId, role, settleMs)
  return build(client, control, inbox, { roomCode, selfId, isHost })
}

/**
 * Who hosts, decided by presence rather than by a probe.
 *
 * The tab transport asked and waited for silence, which needs a timeout tuned
 * to a network. Presence needs none: the room's members are a fact Ably keeps,
 * so the question is just "is one of them already the host".
 *
 * The race is still real — two people opening the same code at once both see no
 * host — and it resolves the way the claim did: lowest id wins. Both clients
 * see the same presence set and reach the same answer, so no round trip is
 * needed to agree.
 */
async function elect(
  control: Ably.RealtimeChannel,
  selfId: PlayerId,
  role: BroadcastRole,
  settleMs: number,
): Promise<boolean> {
  if (role === 'host') {
    await control.presence.enter({ host: true, state: 'online' } satisfies PresenceData)
    return true
  }

  await control.presence.enter({ host: false, state: 'online' } satisfies PresenceData)
  const members = await control.presence.get()
  const hosted = members.some((m) => (m.data as PresenceData | undefined)?.host)

  if (hosted || role === 'guest') return false

  // Nobody is hosting. Claim it, then look again: another tab may have claimed
  // in the same breath, and the lowest id is the one that keeps it.
  await control.presence.update({ host: true, state: 'online' } satisfies PresenceData)
  await new Promise((resolve) => setTimeout(resolve, settleMs))

  const settled = await control.presence.get()
  const claimants = settled
    .filter((m) => (m.data as PresenceData | undefined)?.host)
    .map((m) => m.clientId)
    .sort()

  const won = claimants[0] === selfId
  if (!won) {
    await control.presence.update({ host: false, state: 'online' } satisfies PresenceData)
  }
  return won
}

/* ------------------------------------------------------------------ */
/* The transport                                                       */
/* ------------------------------------------------------------------ */

interface Built {
  roomCode: RoomCode
  selfId: PlayerId
  isHost: boolean
}

function build(
  client: Ably.Realtime,
  control: Ably.RealtimeChannel,
  inbox: Ably.RealtimeChannel,
  { roomCode, selfId, isHost }: Built,
): RoomTransport {
  const intentHandlers = new Set<(intent: Intent) => void>()
  const stateHandlers = new Set<(state: PublicState, meta: StateMeta) => void>()
  const eventHandlers = new Set<(event: RoomEvent) => void>()
  const presenceHandlers = new Set<(entries: readonly PresenceEntry[]) => void>()
  const refusalHandlers = new Set<(reason: string) => void>()
  const statusHandlers = new Set<(status: TransportStatus) => void>()

  /** Host only, opened lazily — one per recipient, per ADR 0007. */
  const outbox = new Map<PlayerId, Ably.RealtimeChannel>()

  let members: readonly PresenceEntry[] = []
  let selfState: ConnectionState = 'online'
  let closed = false

  /* ---------------- inbound ---------------- */

  void inbox.subscribe((message) => {
    if (closed) return
    // Messages are mutable in Ably v2 — an edit or a summary arrives on the
    // same channel. Only a create is a broadcast.
    if (message.action && message.action !== 'message.create') return
    const body = message.data as { state: PublicState; meta: StateMeta }
    for (const handler of [...stateHandlers]) handler(body.state, body.meta)
  })

  void control.subscribe((message) => {
    if (closed) return
    if (message.action && message.action !== 'message.create') return

    if (message.name === INTENT) {
      if (!isHost) return
      const from = message.clientId
      // No `from` means an unidentified client, which our token never issues.
      if (!from) return
      const body = message.data as IntentBody
      // `clientId` is stamped by Ably from the token, not by the sender. This
      // is the line the tab transport had to fake with a token table.
      for (const handler of [...intentHandlers]) handler({ from, action: body.action })
      return
    }

    if (message.name === EVENT) {
      // The same stamping the intent lane does, and for the same reason. The
      // event lane trusted `from` from the payload while nothing published
      // events; chat is what turns that into "post as anyone in the room".
      const from = message.clientId
      if (!from) return
      const event = { ...(message.data as RoomEvent), from } as RoomEvent
      for (const handler of [...eventHandlers]) handler(event)
      return
    }

    if (message.name === REFUSAL) {
      const body = message.data as RefusalBody
      if (body.to !== selfId) return
      for (const handler of [...refusalHandlers]) handler(body.reason)
    }
  })

  /* ---------------- presence ---------------- */

  const readPresence = async () => {
    if (closed) return
    const list = await control.presence.get()
    members = list.map((m) => ({
      id: m.clientId,
      state: (m.data as PresenceData | undefined)?.state ?? 'online',
    }))
    for (const handler of [...presenceHandlers]) handler(members)
  }

  // Every action, not just `enter`: the backfill for members already here
  // arrives as `present`, and subscribing to `enter` alone silently misses
  // everyone who was in the room before we were.
  void control.presence.subscribe(() => {
    void readPresence()
  })
  void readPresence()

  const publishSelf = () => {
    void control.presence.update({ host: isHost, state: selfState } satisfies PresenceData)
  }

  /* ---------------- the interface ---------------- */

  const transport: RoomTransport = {
    roomCode,
    selfId,
    isHost,

    sendIntent(action: ActionInput) {
      if (isHost) {
        // The host's own actions take the same road, but a channel it is not
        // echoing will not hand them back. Deferred, never synchronous — a
        // screen must never be able to assume its send already happened.
        queueMicrotask(() => {
          for (const handler of [...intentHandlers]) handler({ from: selfId, action })
        })
        return
      }
      void control.publish(INTENT, { action } satisfies IntentBody)
    },

    onIntent(handler) {
      if (!isHost) return () => {}
      intentHandlers.add(handler)
      return () => intentHandlers.delete(handler)
    },

    publishState(state, meta, to) {
      if (!isHost) throw new Error('publishState: only the host may broadcast state')
      const targets = to !== undefined ? [to] : [selfId, ...members.map((m) => m.id)]
      for (const id of new Set(targets)) {
        if (id === selfId) {
          queueMicrotask(() => {
            for (const handler of [...stateHandlers]) handler(state, meta)
          })
          continue
        }
        let channel = outbox.get(id)
        if (!channel) {
          channel = client.channels.get(stateChannel(roomCode, id))
          outbox.set(id, channel)
        }
        void channel.publish('state', { state, meta })
      }
    },

    onState(handler) {
      stateHandlers.add(handler)
      return () => stateHandlers.delete(handler)
    },

    publishEvent(event) {
      // Stamped here as well as on receive, so the sender's own echo and
      // everyone else's copy are the same object.
      const stamped = { ...event, from: selfId }
      void control.publish(EVENT, stamped)
      queueMicrotask(() => {
        for (const handler of [...eventHandlers]) handler(stamped)
      })
    },

    onEvent(handler) {
      eventHandlers.add(handler)
      return () => eventHandlers.delete(handler)
    },

    publishRefusal(to, reason) {
      if (!isHost) throw new Error('publishRefusal: only the host may refuse an intent')
      void control.publish(REFUSAL, { to, reason } satisfies RefusalBody)
    },

    onRefusal(handler) {
      refusalHandlers.add(handler)
      return () => refusalHandlers.delete(handler)
    },

    setPresence(state) {
      selfState = state
      publishSelf()
    },

    onPresence(handler) {
      presenceHandlers.add(handler)
      if (members.length > 0) queueMicrotask(() => handler(members))
      return () => presenceHandlers.delete(handler)
    },

    members() {
      return members.map((m) => m.id)
    },

    onStatus(handler) {
      statusHandlers.add(handler)
      // `on` returns void here — the listener itself is the unsubscribe handle.
      const listener = (change: Ably.ConnectionStateChange) => {
        // `update` is an event, not a state: it fires when something changes
        // without a transition, and then `previous === current`.
        if (change.current === change.previous) return
        handler(toStatus(change.current))
      }
      client.connection.on(listener)
      queueMicrotask(() => handler(toStatus(client.connection.state)))
      return () => {
        statusHandlers.delete(handler)
        client.connection.off(listener)
      }
    },

    close() {
      if (closed) return
      closed = true
      void control.presence.leave()
      control.unsubscribe()
      inbox.unsubscribe()
      for (const channel of outbox.values()) channel.unsubscribe()
      outbox.clear()
      intentHandlers.clear()
      stateHandlers.clear()
      eventHandlers.clear()
      presenceHandlers.clear()
      refusalHandlers.clear()
      statusHandlers.clear()
      client.close()
    },
  }

  return transport
}
