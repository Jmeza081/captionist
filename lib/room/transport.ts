import type { ActionInput } from '@/lib/game/actions'
import type { ConnectionState, PlayerId, PublicState, RoomCode } from '@/lib/game/types'

/**
 * The room transport boundary.
 *
 * One rule shapes this file: **the interface exposes the host/guest asymmetry
 * rather than hiding it.** A symmetric `dispatch`/`subscribe` pair reads more
 * cleanly, but it is wrong. Under Ably a guest's send is fire-and-forget with a
 * real round-trip, and that interval is a UI state — "Lock it in" goes pending
 * and must not double-fire. Hide the asymmetry and that state has nowhere to
 * live, so every submit path gets refactored the day Ably lands. Which is
 * precisely what building the spine first exists to prevent.
 *
 * The host applies actions and broadcasts state. Guests send intents and
 * receive state. Events are symmetric — they carry no authority.
 */

/** Every subscription returns its own teardown. */
export type Unsubscribe = () => void

/**
 * A guest's request to change the room, before the host has accepted it.
 *
 * The action arrives as `ActionInput` — without `at` or `actor` — because both
 * are the host's to decide. `from` is the transport's authenticated sender, not
 * a payload field, so a guest cannot act as someone else by editing it.
 */
export interface Intent {
  readonly from: PlayerId
  readonly action: ActionInput
}

/**
 * The broadcast envelope.
 *
 * `hostNow` rides here rather than in `GameState` so each guest can compute
 * clock skew once: the domain has no business knowing that skew exists. `rev`
 * is the monotonic ordering token — guests drop anything at or below the last
 * revision they applied, which makes out-of-order delivery harmless.
 */
export interface StateMeta {
  readonly rev: number
  readonly hostNow: number
  /**
   * How fast the room's clock runs relative to real time — the `?fast` lever,
   * 1 in any normal room.
   *
   * It rides with `hostNow` for the same reason: a guest deriving a countdown
   * needs to know not just where the host's clock *was* but how quickly it is
   * moving, or the number drifts between broadcasts and only snaps back when
   * the next one lands. Like skew, it is a property of the host's clock, and
   * the domain has no business knowing it exists.
   */
  readonly rate?: number
}

/**
 * Anything the room says that is not room state.
 *
 * Chat is an event, never `GameState` — a full-state broadcast per message
 * would be absurd, and chat has no bearing on what the reducer decides. Landing
 * in phase 6; the lane exists now so it does not reshape the interface later.
 */
export type RoomEvent =
  | { kind: 'chat'; from: PlayerId; text: string; at: number }
  | { kind: 'reaction'; from: PlayerId; entryId: string; emoji: string; at: number }

/** Who the transport believes is present, independent of what the reducer thinks. */
export interface PresenceEntry {
  readonly id: PlayerId
  readonly state: ConnectionState
}

/**
 * The transport's own health, not the room's. A guest whose socket dropped
 * still holds the last state it saw; the overlay is driven from here.
 */
export type TransportStatus = 'connecting' | 'connected' | 'disconnected'

export interface RoomTransport {
  readonly roomCode: RoomCode
  /** Who this endpoint is. Stamped onto every intent it sends. */
  readonly selfId: PlayerId
  readonly isHost: boolean

  /** Guest → host, fire and forget. On the host this loops straight back. */
  sendIntent(action: ActionInput): void
  /** Host only. A no-op returning a no-op on a guest, so callers need no branch. */
  onIntent(handler: (intent: Intent) => void): Unsubscribe

  /**
   * Host → everyone, or to one player when `to` is given.
   *
   * Addressed delivery exists because `project()` is *per viewer*: a voter
   * keeps authorship of their own entry so the grid can dim it, while everyone
   * else's is stripped. So the host publishes one projection per recipient
   * rather than a single shared payload.
   *
   * Phase 5 note: this is the one part of the interface Ably does not satisfy
   * for free, since a channel broadcast reaches every subscriber. The options
   * there are a per-member channel or a broadcast carrying only the shared
   * projection plus a private "your entry is `id`" message. Decide it then —
   * recorded here so it is not discovered at swap time.
   */
  publishState(state: PublicState, meta: StateMeta, to?: PlayerId): void
  onState(handler: (state: PublicState, meta: StateMeta) => void): Unsubscribe

  publishEvent(event: RoomEvent): void
  onEvent(handler: (event: RoomEvent) => void): Unsubscribe

  setPresence(state: ConnectionState): void
  onPresence(handler: (entries: readonly PresenceEntry[]) => void): Unsubscribe

  onStatus(handler: (status: TransportStatus) => void): Unsubscribe

  /**
   * Endpoints currently attached, whether or not the room knows them yet.
   *
   * A joining guest is the reason this exists: it is not in `state.players`
   * until its `player/joined` is accepted, but it has to receive the broadcast
   * that prompts it to join. Optional because a transport may not be able to
   * enumerate members; the host falls back to the roster in state.
   */
  members?(): readonly PlayerId[]

  close(): void
}
