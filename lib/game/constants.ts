import type { RoomPhase, RoomSettings } from './types'

/**
 * How long each phase runs, in milliseconds. `null` means untimed.
 *
 * This replaces the prototype's `setInterval` plus a phase-membership list:
 * the same information, expressed as data. `compose` is `null` here because
 * its duration comes from `settings.capSeconds` — see `durationFor`.
 */
export const PHASE_DURATIONS: Readonly<Record<RoomPhase, number | null>> = {
  lobby: null,
  opener: 3_800,
  brief: 30_000,
  compose: null,
  waiting: 12_000,
  vote: 60_000,
  tiebreak: 15_000,
  reveal: null,
  score: null,
  podium: null,
}

/**
 * How long the room sits on `waiting` when every competitor is already in.
 *
 * `waiting` is entered two ways and only one of them still has anyone to wait
 * for. The last entry landing flips the phase immediately (see the reducer), so
 * holding the room for the full 12s there is twelve seconds of a tracker that
 * already reads N of N — and a host button offering to end a wait that is not
 * happening. This is the beat that lets the last submitter read their own
 * confirmation, and no longer.
 */
export const WAITING_ALL_IN_MS = 3_000

/** Resolves the one phase whose length is a room setting. */
export function durationFor(phase: RoomPhase, settings: RoomSettings): number | null {
  if (phase === 'compose') return settings.capSeconds * 1_000
  return PHASE_DURATIONS[phase]
}

/** Ranking points, by ballot position. 3 for first, 2 for second, 1 for third. */
export const RANK_POINTS: readonly number[] = [3, 2, 1]

/** Winning a sudden-death tiebreak is worth one extra point. */
export const TIEBREAK_BONUS = 1

/**
 * A room needs three players: a role holder plus two entries to choose
 * between. The role holder sets the round up and sits it out.
 */
export const MIN_PLAYERS = 3

/**
 * The ceiling on a room, whatever a host asks for.
 *
 * Ten, and the reason is Giphy rather than the game.
 *
 * The design draws a twenty-player room and nothing about the round engine
 * minds one. What minds is `react` mode, where every competitor opens their
 * own picker every round and — with the proxy's cache gone, see
 * `lib/gifs/giphy.ts` — every one of those is a live API call against an
 * allowance of 100 an hour. Ten and five is where the room is held while it is
 * in beta — a full room hunting hard still outruns the free tier partway
 * through, which is a priced trade rather than an accident. See ADR-0021.
 */
export const MAX_PLAYERS = 10

/**
 * What a host is called when they never gave a name.
 *
 * Reaching a room without passing through `/host` is a real path — a shared
 * link, a dev URL — and the roster needs *something*. It is deliberately a word
 * that reads in the third person, because a guest's lobby says it back to them:
 * "You is still herding the rest of the team" is what the obvious choice got.
 */
export const HOST_FALLBACK_NAME = 'Host'

/** A dropped player keeps their seat, and their submission, for this long. */
export const SEAT_GRACE_MS = 60_000

/** Caption fields, per the design's 60-character counter. */
export const CAPTION_MAX = 60

export const DEFAULT_SETTINGS: RoomSettings = {
  mode: 'caption',
  format: 'tb',
  voting: 'rank',
  capSeconds: 90,
  // The biggest room by default, so a host who touches nothing gets the least
  // surprising one — and three rounds, which is what that size affords. A host
  // who wants five lowers the room size and watches the bound move, which is
  // the clearest way to teach that the two are connected.
  maxPlayers: MAX_PLAYERS,
  totalRounds: 3,
  giphyEnabled: true,
  uniqueNicknames: true,
}

/** Bounds the host setup steppers enforce. */
export const CAP_SECONDS_MIN = 30
export const CAP_SECONDS_MAX = 180
export const CAP_SECONDS_STEP = 15
export const ROUNDS_MIN = 1
/** Five for the same reason the room holds ten — see `MAX_PLAYERS`. */
export const ROUNDS_MAX = 5

/**
 * Giphy's free allowance, and what a round is assumed to spend of it.
 *
 * `SEARCHES_PER_ROUND` is 3, so a competitor's *ceiling* is four calls a round
 * — one to arrive plus three searches. Sizing against that ceiling would allow
 * a ten-player room two rounds, which is barely a game, and it would be sizing
 * against a room where every single person exhausts every single search every
 * single round. So the model assumes two of the three get used: **three calls
 * per competitor per round**.
 *
 * A room that beats the assumption is not broken. It ends early, on the podium,
 * saying why — `game/gifsExhausted` is the backstop this leans on, and it is
 * why the number can be an estimate rather than a guarantee. See ADR-0021.
 */
const HOURLY_ALLOWANCE = 100
const ASSUMED_CALLS_PER_COMPETITOR_ROUND = 3

/**
 * The most rounds a room of this size can afford.
 *
 * The role holder sits every round out, so a room of `size` fields `size - 1`
 * competitors and each of them opens a picker every round. That product is the
 * whole cost model:
 *
 *     3–7 players → 5 rounds · 8–9 → 4 · 10 → 3
 *
 * Exposed rather than inlined in `/host` because three places need the same
 * answer: the stepper's bound, the clamp when a room's size drops under a
 * round count it can no longer afford, and the line under the control that
 * says why the bound is where it is.
 */
export function roundsMaxFor(maxPlayers: number): number {
  const competitors = Math.max(1, maxPlayers - 1)
  const affordable = Math.floor(
    HOURLY_ALLOWANCE / (competitors * ASSUMED_CALLS_PER_COMPETITOR_ROUND),
  )
  return Math.min(ROUNDS_MAX, Math.max(ROUNDS_MIN, affordable))
}

/**
 * Avatar fills from the design. Seven colours for a ten-player ceiling, so the
 * palette cycles — `colorFor` below owns that.
 */
export const PLAYER_COLORS: readonly string[] = [
  '#FF787D', // red
  '#F6E338', // yellow
  '#9B7BFF', // purple
  '#86E6F9', // turquoise
  '#B4C36A', // olive
  '#FFC24B', // amber
  '#83D06C', // green
]

/**
 * The seat colour for the nth player to join. Seven colours, ten seats.
 *
 * Lives here rather than in `selectors.ts` because the *reducer* assigns it at
 * join time — a colour is a property of the seat, not a view of it, and the
 * reducer may not import the selector layer it feeds.
 */
export function colorFor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length] ?? '#FF787D'
}

/**
 * Used when the brief clock runs out with nothing locked in. A round must not
 * stall on an absent role holder, and the design's timers are honest.
 */
export const FALLBACK_PROMPTS: readonly string[] = [
  'The deploy went out at 4:59pm on a Friday.',
  'What the standup looks like from the outside.',
  'Prod is fine. Everything is fine.',
  'The retro item nobody wants to raise.',
  'When the on-call pager goes off during dinner.',
  'Your face when the rollback also fails.',
]

/**
 * The prompt field's limit, from the design's `38 / 90` counter on artboard
 * `3a`. Longer than a caption because a prompt is a whole sentence and the
 * captions are punchlines.
 */
export const PROMPT_MAX = 90

/**
 * The Giphy search suggestions under the picker's field, verbatim from the
 * design. They are chips, not a taxonomy — the point is to get an indecisive
 * picker typing something rather than nothing.
 */
export const SEARCH_SUGGESTIONS: readonly string[] = [
  'deploy on friday',
  'merge conflict',
  'it works on my machine',
  'standup',
  'prod is down',
  'legacy code',
]

/**
 * Starters offered to the Prompter, verbatim from the design.
 *
 * Distinct from `FALLBACK_PROMPTS`: these are picked *by a person* who wants a
 * running start, while the fallbacks are what the clock chooses when nobody
 * picked at all.
 */
export const PROMPT_STARTERS: readonly string[] = [
  'when the deploy succeeds on the first try',
  'me explaining the outage to leadership',
  'the intern pushing straight to main',
  'reading the PR description after approving it',
  'day four of the migration',
]
