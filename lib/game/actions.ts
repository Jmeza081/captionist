import type {
  Ballot,
  BotDifficulty,
  EntryAnswer,
  GameMode,
  HatId,
  PlayerId,
  RoomCode,
  RoomPhase,
  RoomSettings,
  RoundSubject,
} from './types'

/**
 * Every action carries who did it and when.
 *
 * `at` is stamped by the host engine at the moment of application, never by
 * the sender — it is what lets the reducer set deadlines without calling
 * `Date.now()` itself. `actor` is set from the authenticated sender for the
 * same reason: a guest must not be able to act as someone else by editing a
 * payload.
 */
export interface ActionMeta {
  readonly at: number
  readonly actor: PlayerId
}

export type GameAction = ActionMeta &
  (
    | { type: 'room/created'; roomCode: RoomCode; host: NewPlayer; settings: RoomSettings; seed: number }
    | { type: 'room/settingsChanged'; patch: Partial<RoomSettings> }
    | { type: 'game/started' }
    | { type: 'player/joined'; player: NewPlayer }
    | { type: 'player/left' }
    | { type: 'player/reconnected' }
    | { type: 'round/subjectLocked'; subject: RoundSubject }
    | { type: 'round/entrySubmitted'; answer: EntryAnswer }
    | { type: 'round/ballotCast'; ballot: Ballot }
    | { type: 'round/tiebreakVoted'; choice: string }
    | { type: 'round/advanced' }
    | { type: 'host/paused' }
    | { type: 'host/resumed' }
    | { type: 'host/adjustedClock'; deltaMs: number }
    | { type: 'host/skippedPhase' }
    | { type: 'host/switchedMode'; mode: GameMode }
    | { type: 'host/forcedTie' }
    | { type: 'host/jumpedToPodium' }
    | { type: 'host/restarted' }
    | { type: 'host/left' }
    /**
     * The host fires a bot.
     *
     * Its own action rather than reusing `player/left`, because a bot has no
     * presence entry to lose and so can never "drop" — and because a held seat
     * is exactly wrong here: `player/left` keeps the chair for
     * `SEAT_GRACE_MS` against a reconnect that is never coming.
     */
    | { type: 'host/botRemoved'; id: PlayerId }
    /**
     * The GIF provider's hourly allowance is spent, so the room stops.
     *
     * Deliberately **not** host-only. Only the client that got the 429 can
     * observe it, and that is rarely the host — they may be the role holder,
     * or sitting the round out. Any seated player may report it.
     */
    | { type: 'game/gifsExhausted' }
    /**
     * The only timer event. Carries the phase it was scheduled for, so a
     * late, duplicate or stale fire is a no-op rather than a bug — which is
     * what removes the need for any cancellation bookkeeping.
     */
    | { type: 'clock/expired'; phase: RoomPhase }
  )

export interface NewPlayer {
  id: PlayerId
  name: string
  avatarSeed: string
  /** Optional because bare-headed is the default. Narrowed by the reducer. */
  hat?: HatId
  /**
   * Set when the host is seating a bot, and to which level.
   *
   * **`authorize` refuses this from anyone but the host.** `player/joined` is
   * deliberately not host-only and has no phase guard — joining is legal in
   * any phase, from any client — so without that check any browser could stuff
   * a room with bots it did not pay for.
   */
  bot?: BotDifficulty
}

export type ActionType = GameAction['type']

/**
 * Actions only the host may take. Kept as one readable table rather than
 * fourteen scattered guards inside the reducer; `authorize.ts` reads it.
 */
export const HOST_ONLY: ReadonlySet<ActionType> = new Set<ActionType>([
  'room/settingsChanged',
  'game/started',
  'round/advanced',
  'host/paused',
  'host/resumed',
  'host/adjustedClock',
  'host/skippedPhase',
  'host/switchedMode',
  'host/forcedTie',
  'host/jumpedToPodium',
  'host/restarted',
  'host/left',
  'host/botRemoved',
])

/** Which phases each action is legal in. Absent means "any phase". */
export const PHASE_GUARDS: Readonly<Partial<Record<ActionType, readonly RoomPhase[]>>> = {
  'room/settingsChanged': ['lobby'],
  'game/started': ['lobby'],
  // `player/joined` is deliberately absent: joining is legal in any phase.
  // The lobby has always told the host "Late joiners can still hop in between
  // rounds", and a lobby-only guard made that a promise the reducer refused.
  // A player who arrives mid-round has no entry in it, so `competitors()`
  // leaves them out on its own; they vote, and compete from the next round.
  'round/subjectLocked': ['brief'],
  // Submitting stays legal through `waiting`: that is what "Edit my caption"
  // is, and the design lets you edit until the clock hits zero.
  'round/entrySubmitted': ['compose', 'waiting'],
  'round/ballotCast': ['vote'],
  'round/tiebreakVoted': ['tiebreak'],
  'round/advanced': ['reveal', 'score'],
  // Every phase a round actually runs in. Not `lobby` — nobody has opened a
  // picker yet — and not `podium`, where the game is already over and a late
  // report from a straggling client would re-enter the phase it is in.
  'game/gifsExhausted': ['opener', 'brief', 'compose', 'waiting', 'vote', 'tiebreak', 'reveal', 'score'],
}

/**
 * `Omit` over a union collapses it to the keys every member shares, which for
 * `GameAction` is just `type`. This distributes instead, so each variant keeps
 * its own payload.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * An action as a caller supplies it, before the host engine stamps `at` and
 * resolves `actor` from the authenticated sender. This is the shape a guest's
 * intent travels in.
 */
export type ActionInput = DistributiveOmit<GameAction, 'at' | 'actor'>
