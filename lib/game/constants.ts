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
export const MAX_PLAYERS = 20

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
  totalRounds: 5,
  giphyEnabled: true,
  uniqueNicknames: true,
}

/** Bounds the host setup steppers enforce. */
export const CAP_SECONDS_MIN = 30
export const CAP_SECONDS_MAX = 180
export const CAP_SECONDS_STEP = 15
export const ROUNDS_MIN = 1
export const ROUNDS_MAX = 10

/**
 * Avatar fills from the design. Seven colours for a twenty-player ceiling, so
 * the palette cycles — `colorFor` below owns that.
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
 * The seat colour for the nth player to join. Seven colours, twenty seats.
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
