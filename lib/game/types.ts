/**
 * The Captionist domain model.
 *
 * Types only — no logic, no imports, no React. Everything the room knows is
 * described here, and `reducer.ts` is the only thing allowed to produce a new
 * `GameState`.
 *
 * Two invariants this file exists to protect:
 *
 * 1. **Nothing in `GameState` is a data URI.** Avatars store a seed and media
 *    stores a URL. A full-state broadcast has to fit inside Ably's 64KB
 *    message cap, and twenty inlined avatars would exhaust it on their own.
 * 2. **`Player` stays structurally assignable to `AvatarProps`.** Every
 *    player-rendering molecule takes `Pick<AvatarProps, 'name' | 'color' |
 *    'src' | 'avatarSeed'>`, so `<PlayerRow player={player} />` typechecks with
 *    no adapter. Keep it that way. `avatarSeed` is in that shape because the
 *    art is rendered from it at the edge — which is what lets invariant 1 hold.
 */

export type PlayerId = string
export type EntryId = string

/** `C-` followed by six characters, e.g. `C-F34213`. */
export type RoomCode = string

/** The two ways a round can run. Never fork a screen on this — branch values. */
export type GameMode = 'caption' | 'react'

/**
 * A GIF or image, by reference. `src` is always a URL: see the no-data-URI
 * invariant above.
 */
export interface MediaRef {
  src: string
  alt: string
  /**
   * The image's intrinsic size, when the source reports one.
   *
   * Two numbers, and they travel because the *card's shape* depends on them:
   * `mediaAspect` in `lib/media.ts` turns them into the ratio every
   * `MediaCard` is drawn at, and a card that learned its shape from the image
   * loading would resize under a caption somebody was already typing. They
   * were dropped here until phase 7 — the card was square and nothing needed
   * them.
   *
   * Optional because plenty of sources report nothing, and a card with no size
   * falls back to the square it always was.
   */
  width?: number
  height?: number
}

export type ConnectionState = 'online' | 'reconnecting' | 'gone'

export interface Player {
  id: PlayerId
  /** Drives the initial and the accessible label. */
  name: string
  /** The circle behind the avatar art. */
  color: string
  /** Resolved avatar art. Derived from `avatarSeed`; absent until resolved. */
  src?: string
  /** Dicebear input. The seed travels, the rendered SVG does not. */
  avatarSeed: string
  isHost: boolean
  connection: ConnectionState
  joinedAt: number
  /** Reconnect grace: the seat is held this long after a drop. */
  seatHeldUntil?: number
}

/**
 * What the round is about.
 *
 * A discriminated union at the leaf, not on `Round` — a union higher up would
 * force every screen to narrow, and those narrowing branches are exactly where
 * duplicate screens grow. Narrowing happens once, in `selectors.ts`.
 *
 * The discriminant is `kind`, not `mode`, because `kind: 'media'` appears on
 * both sides of the mode: it is the subject in caption mode and the answer in
 * react mode.
 */
export type RoundSubject =
  | { kind: 'media'; media: MediaRef }
  | { kind: 'prompt'; text: string }

/** What a player submitted. Same leaf-union reasoning as `RoundSubject`. */
export type EntryAnswer =
  | { kind: 'caption'; lines: readonly string[] }
  | { kind: 'media'; media: MediaRef }

export interface Entry {
  /** Deterministic: `r${round}-e${n}`. Never derived from the author. */
  id: EntryId
  /**
   * Absent in projections while voting is open — see `project.ts`. Host
   * authority means every client holds the full state, so anonymity has to be
   * enforced by redaction rather than by not looking.
   */
  authorId?: PlayerId
  answer: EntryAnswer
  submittedAt: number
}

/**
 * A cast vote.
 *
 * Ballots reference `EntryId`, never `PlayerId`. This is what makes pre-reveal
 * anonymity possible at all, and it is the single most expensive thing to
 * retrofit.
 */
export type Ballot =
  | { kind: 'rank'; ranked: readonly EntryId[] }
  | { kind: 'single'; choice: EntryId }

export interface RoundResult {
  round: number
  winnerEntryId: EntryId
  /** Points earned this round only. Totals are folded from history. */
  points: Readonly<Record<PlayerId, number>>
  /** Entry ids by points descending — the reveal's runners-up come from here. */
  ranking: readonly EntryId[]
  /** Resolved at the reveal, so the scoreboard can name authors. */
  authorOf: Readonly<Record<EntryId, PlayerId>>
}

export interface Tiebreak {
  contenders: readonly EntryId[]
  votes: Readonly<Record<PlayerId, EntryId>>
  /** Committed when the tiebreak resolves; the winner also takes +1. */
  pending: RoundResult
}

export interface Round {
  number: number
  roleHolderId: PlayerId
  /** `null` until the role holder locks one in, or the clock picks a fallback. */
  subject: RoundSubject | null
  entries: readonly Entry[]
  ballots: Readonly<Record<PlayerId, Ballot>>
  /** The seeded vote-grid shuffle. Empty until the vote phase opens. */
  order: readonly EntryId[]
  tiebreak: Tiebreak | null
}

/**
 * Where the room is.
 *
 * Ten phases, not the design's fourteen screens. `landing`, `join` and
 * `setup` are routes, not phases — no room exists during them. And
 * `pick`/`pickwait` and `prompt`/`promptwait` are one phase (`brief`) rendered
 * four ways: phase is room-wide and authoritative, "is it my turn" is
 * per-viewer and derived. Same for `caption`/`submit` → `compose`.
 */
export type RoomPhase =
  | 'lobby'
  | 'opener'
  | 'brief'
  | 'compose'
  | 'waiting'
  | 'vote'
  | 'tiebreak'
  | 'reveal'
  | 'score'
  | 'podium'

/**
 * The round clock, as an absolute deadline rather than a countdown.
 *
 * Storing `endsAt` instead of `secondsLeft` means no drift, no dependence on
 * tick delivery, and a late joiner is correct from a single number. `totalMs`
 * rides along only so `ProgressRail` can compute its fraction without a
 * second lookup.
 */
export type Clock =
  | { status: 'idle' }
  | { status: 'running'; endsAt: number; totalMs: number }
  | { status: 'paused'; remainingMs: number; totalMs: number }

export interface RoomSettings {
  mode: GameMode
  /** `tb` is top-and-bottom; `one` asks for a single caption line. */
  format: 'tb' | 'one'
  /** `rank` pays 3/2/1 across three picks; `single` pays 1 to one. */
  voting: 'rank' | 'single'
  /** The compose clock, in seconds. 30–180 in steps of 15. */
  capSeconds: number
  totalRounds: number
  giphyEnabled: boolean
  uniqueNicknames: boolean
}

export interface GameState {
  roomCode: RoomCode
  hostId: PlayerId
  createdAt: number
  settings: RoomSettings
  /** Join order. Role rotation is an index modulo this. */
  players: readonly Player[]
  phase: RoomPhase
  clock: Clock
  roundNumber: number
  roleHolderIndex: number
  /** `null` in the lobby and once the game is over. */
  round: Round | null
  history: readonly RoundResult[]
  /**
   * PRNG cursor. The reducer draws from this rather than calling
   * `Math.random`, which is what keeps it pure and the vote shuffle
   * reproducible under `?seed=`.
   */
  seed: number
  /** Monotonic. The transport's ordering token; guests drop anything older. */
  rev: number
}

/**
 * `GameState` as broadcast. Identical, except authorship is stripped while
 * voting is open. See `project.ts`.
 */
export type PublicState = GameState
