import type {
  Ballot,
  EntryAnswer,
  GameMode,
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
])

/** Which phases each action is legal in. Absent means "any phase". */
export const PHASE_GUARDS: Readonly<Partial<Record<ActionType, readonly RoomPhase[]>>> = {
  'room/settingsChanged': ['lobby'],
  'game/started': ['lobby'],
  'player/joined': ['lobby'],
  'round/subjectLocked': ['brief'],
  // Submitting stays legal through `waiting`: that is what "Edit my caption"
  // is, and the design lets you edit until the clock hits zero.
  'round/entrySubmitted': ['compose', 'waiting'],
  'round/ballotCast': ['vote'],
  'round/tiebreakVoted': ['tiebreak'],
  'round/advanced': ['reveal', 'score'],
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
