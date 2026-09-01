import type { ActionInput } from '@/lib/game/actions'
import type {
  ConnectionState,
  GameMode,
  PlayerId,
  PublicState,
  RoomCode,
} from '@/lib/game/types'

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
 * would be absurd, and chat has no bearing on what the reducer decides. The
 * lane was cut in phase 1 and filled in phase 6, and the interface did not move
 * to accommodate it, which is what it was shaped early for.
 *
 * **`from` is the transport's, not the sender's.** Every implementation
 * overwrites it on receive with the identity it authenticated, exactly as
 * `Intent.from` is. A payload field would let any member post as anyone else
 * the moment chat existed to carry it.
 */
/** A GIF sent with a message. `src` is checked on receive, never on send. */
export interface ChatAttachment {
  src: string
  alt: string
}

/**
 * The caption a message answers — a **snapshot, not a reference**.
 *
 * It carries the entry's content and deliberately not its `EntryId`, for two
 * reasons that pull the same way:
 *
 * 1. **Lifetime.** `round.entries` is replaced wholesale when the round turns
 *    over, and nothing in `history` keeps a caption's text or its media. Chat
 *    scrollback is 50 messages and outlives the round by design. An id would
 *    resolve to nothing by round three — which is exactly when the design's
 *    reason for the quote ("keeps the reply legible after the grid has
 *    scrolled") starts to matter.
 * 2. **The store's contract.** `EventStoreOptions.isMember` is a predicate
 *    rather than a roster precisely so this store holds no copy of game state.
 *    Resolving an id at render would make a thing that was *said* change what
 *    it says because the room moved on.
 *
 * **Never carries authorship.** `project()` strips `authorId` while voting is
 * open; a "replying to Jesska's caption" label would hand that back by a second
 * route, which is the failure `redactTiebreak` already exists to prevent.
 *
 * The id is omitted on purpose. If a jump-to-the-card affordance is ever
 * wanted, add it then with its own reason — an id that nothing resolves is a
 * trap for whoever helpfully resolves it.
 */
export interface ChatQuote {
  /** The entry's thumbnail. Absent when the round had no image to show. */
  src?: string
  /** The caption text, as the grid showed it. */
  caption: string
}

/**
 * What the room says about itself — a code and its subject, never a sentence.
 *
 * Three reasons pulling the same way. Copy is the client's and lives beside
 * every other string, so a line the host's build renders is a line every other
 * build has to agree with forever. A rendered sentence on this lane is
 * sender-supplied text, which is exactly what the length cap and the allowlist
 * on the chat lane exist to distrust. And a `PlayerId` lets the log resolve a
 * name through the roster the way a chat author's is resolved, rather than
 * baking in whatever it was called at publish time.
 */
export type AnnouncementBody =
  | { code: 'mode'; mode: GameMode }
  | { code: 'left'; who: PlayerId }
  | { code: 'returned'; who: PlayerId }

export type RoomEvent =
  | {
      kind: 'chat'
      from: PlayerId
      text: string
      at: number
      attachment?: ChatAttachment
      replyTo?: ChatQuote
    }
  | {
      kind: 'reaction'
      from: PlayerId
      /**
       * What is being reacted to.
       *
       * A third `kind` was the obvious shape and the wrong one: reacting to a
       * card and reacting to a message are the same act against different
       * things, so they share a handler, a tally derivation and a rate limit.
       * Splitting the kind would have duplicated all three.
       *
       * `room` is the odd one and stays here for the same reason: it is the
       * same act against nothing in particular. It carries no `targetId` worth
       * reading and leaves no tally — see `receiveReaction`.
       */
      target: ReactionTarget
      targetId: string
      emoji: string
      at: number
    }
  | {
      /**
       * The room speaking about itself — a mode switch, a player dropping, a
       * player coming back.
       *
       * Its own kind rather than a flag on `chat`, because the two differ in
       * everything but where they land: an announcement has no attachment, no
       * quote, no rate limit and no author who chose to write it. It is
       * published by the **host engine**, so `from` is the host's id and the
       * transport stamps it exactly as it stamps every other event — the
       * sender really is who the wire says. See ADR 0028.
       */
      kind: 'announcement'
      from: PlayerId
      body: AnnouncementBody
      at: number
    }

/**
 * An entry in a vote grid, one message in the room chat, or the room itself.
 *
 * `room` is DESIGNSYSTEM.md's "REACT TO THE ROOM" — the rail's picker, and what
 * the composer's keys fall back to when there is no message to aim at. The
 * design's own prototype fires floaters and stores nothing for it, so it is a
 * burst with no count behind it.
 */
export type ReactionTarget = 'entry' | 'message' | 'room'

/**
 * The `targetId` a room reaction carries.
 *
 * A room reaction is not *about* anything, but the wire shape wants a string
 * and an empty one reads like a bug. Never used as a key: nothing tallies it.
 */
export const ROOM_TARGET = 'room'

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
   * This is the one part of the interface a channel does not satisfy for free,
   * since a broadcast reaches every subscriber identically. It was recorded
   * here as phase 5's question and arrived a phase early, because
   * `BroadcastChannel` is the same shape: `BroadcastTransport` answers it with
   * **one channel per recipient**, and `AblyTransport` inherits that answer.
   * See [ADR 0007](../../docs/adr/0007-the-first-tab-to-ask-owns-the-room.md).
   */
  publishState(state: PublicState, meta: StateMeta, to?: PlayerId): void
  onState(handler: (state: PublicState, meta: StateMeta) => void): Unsubscribe

  publishEvent(event: RoomEvent): void
  onEvent(handler: (event: RoomEvent) => void): Unsubscribe

  /**
   * Host → the one player whose intent was refused.
   *
   * A refusal is addressed and private: it belongs to the person who asked, and
   * broadcasting "Jesse cannot vote for their own" to the room would be both
   * noise and a leak. It carries no authority — it is the host explaining a
   * decision already made, so it is not state and not an event.
   *
   * This lane exists from phase 4 rather than phase 5. While every endpoint
   * shared a page, `HostEngine`'s `onRefused` callback reached the asker
   * in-process; the moment a guest lives in another tab, an in-process callback
   * reaches nobody and a blocked button goes quiet instead of explaining
   * itself. `authorize.ts` returns finished sentences precisely so this lane
   * can carry them straight to a snackbar.
   */
  publishRefusal(to: PlayerId, reason: string): void
  onRefusal(handler: (reason: string) => void): Unsubscribe

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
