import type {
  Ballot,
  BotDifficulty,
  EntryAnswer,
  MediaRef,
  PlayerId,
  RoomSettings,
  RoundSubject,
} from '@/lib/game/types'

/**
 * What a bot is, as a contract — and nothing that fetches.
 *
 * Types only in here, personas in `personas.ts`, adapters beside them. The
 * same split `lib/gifs/provider.ts` uses, and for the same reason: the room's
 * hot path needs the vocabulary without dragging a client in with it.
 */

/**
 * How ruthless a bot is.
 *
 * Declared in `lib/game/types.ts` because it travels on the wire inside
 * `Player`, and re-exported here so the seam reads whole. The room's own
 * vocabulary rather than easy/medium/hard, because the room's voice is an
 * engineering team's. See `personas.ts` for what each level changes.
 */
export type { BotDifficulty } from '@/lib/game/types'

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['intern', 'senior', 'principal']

export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return typeof value === 'string' && (BOT_DIFFICULTIES as readonly string[]).includes(value)
}

/**
 * Narrow a level arriving from a browser, the way `asHatId` narrows a hat.
 *
 * The reducer's trust boundary: this value selects which persona a prompt is
 * built from, so `GameState` may hold nothing but the three.
 */
export function asBotDifficulty(value: unknown): BotDifficulty | undefined {
  return isBotDifficulty(value) ? value : undefined
}

/** One bot, as the pool holds it. */
export interface SeatedBot {
  id: PlayerId
  name: string
  difficulty: BotDifficulty
  /** Stable position. Every deterministic fallback is keyed on it. */
  index: number
}

/**
 * What a bot is told about the round it is playing.
 *
 * Deliberately not `PublicState`. A brain that took the whole projection could
 * read anything the projection happens to carry today, and a later field would
 * silently widen what leaves the tab. This is the whole list.
 */
export interface RoundContext {
  mode: RoomSettings['mode']
  format: RoomSettings['format']
  roundNumber: number
}

/** Setting a round up: a GIF to caption, or a prompt to answer. */
export interface SubjectContext extends RoundContext {
  /** Who is asking, so a fallback can stay positional. */
  bot: SeatedBot
}

/**
 * Writing the answers — **for every bot at once**.
 *
 * Plural because one call serves the whole pool. That is what makes the room
 * affordable, and it is also the only way to ask for lines that differ from
 * each other: N independent calls cannot know what the others wrote, and
 * converge on the same joke.
 */
export interface AnswersContext extends RoundContext {
  bots: readonly SeatedBot[]
  /** What the round is about, as the bots can see it. */
  subject: BotSubject
}

/** Ranking rivals — again for every bot at once. */
export interface BallotsContext extends RoundContext {
  bots: readonly SeatedBot[]
  voting: RoomSettings['voting']
  /** How many places a ballot ranks. */
  places: number
  /**
   * The cards on the board, **without authorship**. `project()` already
   * stripped it; this type is where that guarantee stops being incidental.
   */
  cards: readonly BallotCard[]
}

export interface BallotCard {
  entryId: string
  /** A caption's words, or an answering GIF's title. Never a name. */
  text: string
  /** Set when the entry is a GIF, so a brain with eyes can look at it. */
  media?: MediaRef
}

/**
 * The round's subject, as a brain receives it.
 *
 * `query` is what the picker searched to find this GIF — a human-authored
 * description of the joke intended, which would otherwise be thrown away.
 */
export type BotSubject =
  | { kind: 'media'; media: MediaRef; query?: string }
  | { kind: 'prompt'; text: string }

/**
 * Where a bot's comedy comes from.
 *
 * Two implementations: `claude` calls the route, `stub` is written-in and
 * offline. The stub is not a courtesy — the test suite cannot reach a network
 * and a fresh clone has no key, which is the same pair of reasons
 * `SAMPLE_GIFS` exists.
 */
export interface BotBrain {
  readonly id: 'claude' | 'stub'
  subject(ctx: SubjectContext): Promise<RoundSubject>
  answers(ctx: AnswersContext): Promise<ReadonlyMap<PlayerId, EntryAnswer>>
  ballots(ctx: BallotsContext): Promise<ReadonlyMap<PlayerId, Ballot>>
}
