import { isAllowedImageSrc } from '@/lib/gifs/allow'
import type { PlayerId } from '@/lib/game/types'
import type {
  AnnouncementBody,
  ChatAttachment,
  ChatQuote,
  ReactionTarget,
  RoomEvent,
  Unsubscribe,
} from './transport'

/**
 * Everything the room said that the reducer never sees.
 *
 * A second store beside `RoomStore`, deliberately. Chat could have been folded
 * into `GameState` for one afternoon's convenience and it would have been
 * wrong twice over: the host broadcasts a projection of the whole room on every
 * revision, so a message would cost a full state fan-out per keystroke-worth of
 * content — and worse, `rev` is the ordering token guests drop against, so
 * chatter would bump the number that decides whether a *game* update is stale.
 *
 * Same two constraints as `RoomStore`, for the same React 19 reasons:
 * `getSnapshot` returns a stable reference between real changes, and nothing
 * time-varying lives in the snapshot.
 */

/**
 * How long a sender must wait between messages, in milliseconds.
 *
 * Enforced where events *arrive*, not where they are sent. A throttle on the
 * composer binds only the tab that agreed to run it, which is every tab except
 * the one worth throttling.
 */
export const CHAT_INTERVAL_MS = 1_500

/** Longest message the room will carry. Truncated, not refused. */
export const CHAT_MAX_LENGTH = 140

/**
 * How long a sender must wait between room reactions, in milliseconds.
 *
 * The other two targets are throttled for free: a reaction is one per person
 * per emoji per target, so the second identical one is already a no-op. A room
 * reaction has nothing to dedupe against — repeating it *is* the feature — so
 * it is the one target that needs a clock. Same local-clock rule as chat, and
 * for the same reason: `at` is a number the sender chose.
 */
export const ROOM_REACTION_INTERVAL_MS = 1_500

/**
 * How many messages a tab keeps.
 *
 * There is no database and the room dies with its host, so scrollback is a
 * session's worth of memory rather than a promise of history.
 */
export const CHAT_HISTORY = 50

/** Longest alt text the room will carry, same budget as a message. */
export const ATTACHMENT_ALT_MAX = 140

/** A quote cannot be longer than the caption it quotes. */
export const QUOTE_CAPTION_MAX = 60

export interface ChatEntry {
  /**
   * Discriminator, so a log entry narrows instead of carrying dead optionals.
   *
   * Added when announcements arrived: `text`, `attachment` and `replyTo` are
   * all meaningless on one, and an optional field on a shared interface invites
   * `entry.text` on a thing that has none.
   */
  readonly kind: 'chat'
  /** Local to this tab, and only ever a render key. */
  readonly id: string
  readonly from: PlayerId
  readonly text: string
  readonly at: number
  readonly attachment?: ChatAttachment
  readonly replyTo?: ChatQuote
}

/**
 * The room said this, not a player — `ChatMessage`'s accent card.
 *
 * Same list and same store as chat, because it occupies the same slot in the
 * same stream; a second lane would be a second thing to interleave and to
 * scroll.
 */
export interface AnnouncementEntry {
  readonly kind: 'announcement'
  readonly id: string
  /** The host, who published it. Never drawn — see `ROOM_FACE`. */
  readonly from: PlayerId
  readonly body: AnnouncementBody
  readonly at: number
}

/** One line in the log: something a player said, or something the room did. */
export type LogEntry = ChatEntry | AnnouncementEntry

/**
 * Narrows a log entry to something a player actually said.
 *
 * Exported because two callers need it and both would otherwise write the
 * predicate inline: the rail, which reacts to messages and never to
 * announcements, and the toast lane.
 */
export function isChat(entry: LogEntry): entry is ChatEntry {
  return entry.kind === 'chat'
}

/** One emoji's running count against one target. */
export interface Tally {
  readonly emoji: string
  readonly count: number
  /** You are one of the people in this count. */
  readonly mine: boolean
}

export interface EventSnapshot {
  /** Oldest first, capped at `CHAT_HISTORY`. */
  readonly messages: readonly LogEntry[]
  /**
   * Tallies by target, keyed `entry:<id>` / `message:<id>`.
   *
   * A record rather than a Map so a screen can read one key without
   * subscribing to every other card's counts.
   */
  readonly tallies: Readonly<Record<string, readonly Tally[]>>
  /** Messages that arrived while chat was closed. */
  readonly unread: number
  /** The first message of that run, so the divider can sit above it. */
  readonly firstUnreadId: string | undefined
  /**
   * The most recent reaction, for the emoji burst.
   *
   * `key` rises on every reaction including a repeat of the same emoji, which
   * is what lets the floaters fire twice for two 🔥 rather than once. The
   * animation reads the pair and ignores the value.
   */
  readonly lastReaction: { readonly emoji: string; readonly key: number } | undefined
}

export interface EventStore {
  subscribe(listener: () => void): Unsubscribe
  getSnapshot(): EventSnapshot
  getServerSnapshot(): EventSnapshot
  /** One event off the wire. Guards run here. */
  receive(event: RoomEvent): void
  /** Chat is open, so nothing is unread any more. */
  markRead(): void
}

export interface EventStoreOptions {
  /**
   * Who this tab is, so `mine` on a tally means something.
   *
   * A getter, not a value: a tab does not know its own seat until the claim
   * probe resolves, and the store is built before that answer arrives.
   */
  self: () => PlayerId
  /**
   * Whether a sender is actually in the room.
   *
   * A predicate rather than a roster, because membership lives in `RoomStore`
   * and this store must not hold a stale copy of it.
   */
  isMember?: (from: PlayerId) => boolean
  /**
   * Whether a sender is the room's host.
   *
   * The guard that makes an accent card mean something. Without it any member
   * can publish `kind: 'announcement'` and every browser in the room renders it
   * as *the room* speaking — a member typing "Mode is now…" in chat is a joke,
   * and the same words on the room's own card are a lie the room told.
   *
   * A predicate for the same reason `isMember` is one: the host is
   * `state.hostId`, and this store holds no copy of game state.
   */
  isRoomHost?: (from: PlayerId) => boolean
  /** Injectable so the rate limit is testable without waiting 1.5 real seconds. */
  now?: () => number
}

/** Whether two announcements say the same thing about the same subject. */
function sameBody(a: AnnouncementBody, b: AnnouncementBody): boolean {
  if (a.code !== b.code) return false
  if (a.code === 'mode') return b.code === 'mode' && a.mode === b.mode
  return 'who' in b && a.who === b.who
}

export function tallyKey(target: ReactionTarget, targetId: string): string {
  return `${target}:${targetId}`
}

/** Longest reaction glyph the room will carry — an emoji, or a tile's URL. */
export const GLYPH_MAX = 512

/**
 * Whether a reaction's glyph may be tallied.
 *
 * An emoji is a character and renders as text; an image tile's glyph is a URL
 * and renders as an `<img>`. Anything that *looks* like a location has to clear
 * the same allowlist an attachment does, or the reaction lane becomes the
 * unguarded twin of the one above it.
 */
function isAllowedGlyph(glyph: string): boolean {
  if (typeof glyph !== 'string') return false
  const trimmed = glyph.trim()
  if (!trimmed || trimmed.length > GLYPH_MAX) return false
  const looksLikeLocation = trimmed.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  return looksLikeLocation ? isAllowedImageSrc(trimmed) : true
}

/**
 * A sender-supplied attachment, or nothing.
 *
 * **Degrade, never refuse.** A disallowed source drops the attachment and lets
 * the words through; the empty guard above then decides whether anything is
 * left. Refusing the whole message would lose text the sender wrote over a
 * picture they picked.
 */
function cleanAttachment(attachment: ChatAttachment | undefined): ChatAttachment | undefined {
  if (!attachment || !isAllowedImageSrc(attachment.src)) return undefined
  // An empty alt becomes the accessible name, so it gets the same fallback the
  // Giphy mapper uses rather than being left blank.
  const alt = attachment.alt.trim().slice(0, ATTACHMENT_ALT_MAX) || 'A GIF'
  return { src: attachment.src, alt }
}

/**
 * A quoted caption, or nothing.
 *
 * The thumbnail can fail on its own — a quote is still legible as text — so a
 * bad `src` drops only the picture. An empty caption drops the whole quote,
 * because an accent rule over nothing says less than no quote at all.
 */
function cleanQuote(quote: ChatQuote | undefined): ChatQuote | undefined {
  if (!quote) return undefined
  const caption = quote.caption.trim().slice(0, QUOTE_CAPTION_MAX)
  if (!caption) return undefined
  const src = quote.src && isAllowedImageSrc(quote.src) ? quote.src : undefined
  return src ? { src, caption } : { caption }
}

const EMPTY: EventSnapshot = {
  messages: [],
  tallies: {},
  unread: 0,
  firstUnreadId: undefined,
  lastReaction: undefined,
}

export function createEventStore(options: EventStoreOptions): EventStore {
  const { self, isMember, isRoomHost, now = Date.now } = options

  let snapshot: EventSnapshot = EMPTY
  const listeners = new Set<() => void>()

  /** Last accepted message per sender, on the *local* clock — see below. */
  const lastMessageAt = new Map<PlayerId, number>()
  /** Room reactions have no tally to dedupe against, so they get a clock. */
  const lastRoomReactionAt = new Map<PlayerId, number>()
  /** One reaction per person per emoji per target. Re-sending is a no-op. */
  const reacted = new Set<string>()
  let seq = 0
  let bursts = 0

  const emit = () => {
    for (const listener of [...listeners]) listener()
  }

  const receiveChat = (event: Extract<RoomEvent, { kind: 'chat' }>): void => {
    const text = event.text.trim().slice(0, CHAT_MAX_LENGTH)
    const attachment = cleanAttachment(event.attachment)
    const replyTo = cleanQuote(event.replyTo)

    // A GIF on its own is a complete message — `Composer.canSend` says the same
    // thing on the way out, and the two have to agree or a message a player
    // watched themselves send would vanish with no explanation. A quote alone
    // is *not* a message: it is context for something unsaid.
    if (!text && !attachment) return

    // **The local clock, never the event's.** `at` is a number a sender chose,
    // so a flooding tab would simply stamp its messages 1.5s apart and walk
    // straight through a limit that read it. An attachment buys no second
    // budget — one GIF per 1.5s is the same allowance as one line.
    const arrived = now()
    const last = lastMessageAt.get(event.from)
    if (last !== undefined && arrived - last < CHAT_INTERVAL_MS) return
    lastMessageAt.set(event.from, arrived)

    seq += 1
    const entry: ChatEntry = {
      kind: 'chat',
      id: `m${seq}`,
      from: event.from,
      text,
      at: event.at,
      ...(attachment ? { attachment } : {}),
      ...(replyTo ? { replyTo } : {}),
    }
    const messages = [...snapshot.messages, entry].slice(-CHAT_HISTORY)

    // Your own message never counts as unread — you just wrote it — and it
    // must not open a divider above itself.
    const mine = event.from === self()
    snapshot = {
      ...snapshot,
      messages,
      unread: mine ? snapshot.unread : snapshot.unread + 1,
      firstUnreadId: mine ? snapshot.firstUnreadId : (snapshot.firstUnreadId ?? entry.id),
    }
    emit()
  }

  /**
   * The room's own line, appended like any other message.
   *
   * **Not routed through `receiveChat`**, and the differences are the reason
   * the kind exists. There is no text to truncate — the wire carries a code and
   * the words are rendered client-side. And it skips `CHAT_INTERVAL_MS`, which
   * is not an oversight: that limit bounds a *member* flooding the log at will,
   * while the host emits one line per accepted state transition and the reducer
   * is what bounds those. A wifi router dying drops three players in one
   * presence sweep — three legitimate lines inside 1.5s, and the chat limiter
   * would silently eat two of them at the moment the log most needs to be right.
   *
   * What it keeps is `CHAT_HISTORY`: a line takes a slot like any other.
   */
  const receiveAnnouncement = (
    event: Extract<RoomEvent, { kind: 'announcement' }>,
  ): void => {
    // The one guard that replaces the clock. A member is not enough here.
    if (isRoomHost && !isRoomHost(event.from)) return

    // A repeat of the line already at the end of the log, dropped — a host
    // republishing after an Ably resume is the case, and one comparison
    // absorbs it without a timestamp anybody could disagree about.
    const newest = snapshot.messages[snapshot.messages.length - 1]
    if (newest?.kind === 'announcement' && sameBody(newest.body, event.body)) return

    seq += 1
    const entry: AnnouncementEntry = {
      kind: 'announcement',
      id: `m${seq}`,
      from: event.from,
      body: event.body,
      at: event.at,
    }
    const messages = [...snapshot.messages, entry].slice(-CHAT_HISTORY)

    // Unread for everyone, the host included — the badge is how somebody with
    // the rail shut finds out the mode changed under them, which is the whole
    // reason this lane exists. Keying `mine` off the sender the way chat does
    // would exempt the host's own tab from every drop line too.
    snapshot = {
      ...snapshot,
      messages,
      unread: snapshot.unread + 1,
      firstUnreadId: snapshot.firstUnreadId ?? entry.id,
    }
    emit()
  }

  const receiveReaction = (event: Extract<RoomEvent, { kind: 'reaction' }>): void => {
    // The wire carries the *glyph*, because that is what a tally has to render
    // — and once the picker has image tiles a glyph is a URL, so this lane
    // points twenty browsers at whatever the sender chose. Same allowlist as an
    // attachment; the cap keeps a 4KB string out of `tallies` fifty times over.
    if (!isAllowedGlyph(event.emoji)) return

    // A room reaction is the burst and nothing else. DESIGNSYSTEM's "REACT TO
    // THE ROOM" leaves no count behind it — the design's prototype fires
    // floaters and stores nothing — so there is no tally, and with no tally
    // there is nothing to dedupe against. That drops the guard the other two
    // targets get for free, which is why this branch is the one with a clock.
    if (event.target === 'room') {
      const arrived = now()
      const last = lastRoomReactionAt.get(event.from)
      if (last !== undefined && arrived - last < ROOM_REACTION_INTERVAL_MS) return
      lastRoomReactionAt.set(event.from, arrived)

      bursts += 1
      snapshot = { ...snapshot, lastReaction: { emoji: event.emoji, key: bursts } }
      emit()
      return
    }

    const key = tallyKey(event.target, event.targetId)
    const once = `${key}:${event.from}:${event.emoji}`
    if (reacted.has(once)) return
    reacted.add(once)

    const mine = event.from === self()
    const current = snapshot.tallies[key] ?? []
    const at = current.findIndex((t) => t.emoji === event.emoji)

    // Counts only ever rise. The design draws no un-react, and a count that
    // could fall would need per-person state on every tally to know whose.
    const next =
      at === -1
        ? [...current, { emoji: event.emoji, count: 1, mine }]
        : current.map((t, i) =>
            i === at ? { emoji: t.emoji, count: t.count + 1, mine: t.mine || mine } : t,
          )

    bursts += 1
    // Only the key that changed is rebuilt, so a card whose tallies did not
    // move keeps its array identity and does not re-render.
    snapshot = {
      ...snapshot,
      tallies: { ...snapshot.tallies, [key]: next },
      lastReaction: { emoji: event.emoji, key: bursts },
    }
    emit()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY,

    receive(event) {
      // Somebody who is not in the room has nothing to say to it. This is the
      // one guard that holds on every transport, including the ones where a
      // sender's identity is asserted rather than issued.
      if (isMember && !isMember(event.from)) return
      if (event.kind === 'chat') receiveChat(event)
      else if (event.kind === 'announcement') receiveAnnouncement(event)
      else receiveReaction(event)
    },

    markRead() {
      if (snapshot.unread === 0 && snapshot.firstUnreadId === undefined) return
      snapshot = { ...snapshot, unread: 0, firstUnreadId: undefined }
      emit()
    },
  }
}
