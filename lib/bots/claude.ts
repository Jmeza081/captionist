import type { Ballot, EntryAnswer, PlayerId, RoundSubject } from '@/lib/game/types'
import { fetchBoard } from '@/lib/gifs/source'
import { toMediaRef, type GifResult } from '@/lib/gifs/types'
import { sampleAt } from '@/lib/gifs/samples'
import { readSeat, readSeatSignature } from '@/lib/room/identity'
import { recordSpend } from './budget'
import type { AnswersContext, BallotsContext, BotBrain, SubjectContext } from './types'

/**
 * The model, reached through our own route.
 *
 * **The route only writes words.** Every GIF is still fetched here, in the
 * browser, because that is where the provider key lives and has to
 * (ADR 0020, ADR 0022) — so the model's job is a *search query* and the
 * browser's is turning it into a picture. Asking the server for a GIF would
 * rebuild the proxy ADR 0020 deleted.
 */

interface TurnResponse {
  /** Caption mode: what to search for. React mode returns a prompt instead. */
  query?: string
  subject?: RoundSubject
  answers?: Record<PlayerId, { kind: 'caption'; lines: string[] } | { query: string }>
  ballots?: Record<PlayerId, Ballot>
  usage?: { input: number; output: number; model?: string }
  stub?: boolean
}

class BotRouteError extends Error {}

/** How many tiles to ask for. Enough that nineteen bots can each take a different one. */
const BOARD_SIZE = 25

async function ask(body: unknown): Promise<TurnResponse> {
  const seat = readSeat()
  const sig = readSeatSignature()
  if (!seat || !sig) {
    // No signed seat means the route would refuse us anyway. Failing here
    // rather than there keeps a pointless round trip off the round's clock.
    throw new BotRouteError('This tab has no signed seat, so bots cannot ask for jokes.')
  }

  const response = await fetch('/api/bots/turn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ ...(body as object), seat, sig }),
  })

  if (!response.ok) throw new BotRouteError(`The bot route answered ${response.status}.`)

  const parsed = (await response.json()) as TurnResponse
  if (parsed.usage) recordSpend(parsed.usage.input, parsed.usage.output, parsed.usage.model)
  if (parsed.stub) throw new BotRouteError('No model key is configured.')
  return parsed
}

/** One search, or an empty board if the provider is down — never a throw. */
async function boardFor(query: string): Promise<readonly GifResult[]> {
  try {
    const board = await fetchBoard(query, undefined, BOARD_SIZE)
    return board.results
  } catch {
    // A provider that is down must not take the round with it.
    return []
  }
}

/**
 * A board becomes a picture.
 *
 * `pick` offsets into the results so no two bots answer with the same GIF — a
 * vote grid showing the same card twice is a bug you only ever see with bots.
 * A board that came back empty falls to the offline shelf rather than leaving
 * a bot with no answer.
 */
function pickFrom(board: readonly GifResult[], pick: number): ReturnType<typeof toMediaRef> {
  const chosen = board[pick % Math.max(1, board.length)]
  return chosen ? toMediaRef(chosen) : toMediaRef(sampleAt(pick))
}

/** A single subject, for the one caller that needs exactly one. */
async function gifFor(query: string, pick: number): Promise<ReturnType<typeof toMediaRef>> {
  return pickFrom(await boardFor(query), pick)
}

export const claudeBrain: BotBrain = {
  id: 'claude',

  async subject(ctx: SubjectContext): Promise<RoundSubject> {
    const answer = await ask({
      kind: 'subject',
      mode: ctx.mode,
      roundNumber: ctx.roundNumber,
      bots: [{ id: ctx.bot.id, difficulty: ctx.bot.difficulty }],
    })

    // React mode's subject is a sentence, so the route returns it whole and
    // nothing here has to touch a provider.
    if (ctx.mode === 'react') {
      if (answer.subject?.kind !== 'prompt') {
        throw new BotRouteError('The route returned no prompt.')
      }
      return answer.subject
    }
    if (!answer.query) throw new BotRouteError('The route returned no query.')
    const media = await gifFor(answer.query, ctx.roundNumber)
    // The query rides along: it is the best description of the intended joke
    // anyone will ever have of this GIF, and every bot captioning it gets it.
    return { kind: 'media', media, query: answer.query }
  },

  async answers(ctx: AnswersContext): Promise<ReadonlyMap<PlayerId, EntryAnswer>> {
    const answer = await ask({
      kind: 'answers',
      mode: ctx.mode,
      format: ctx.format,
      roundNumber: ctx.roundNumber,
      subject:
        ctx.subject.kind === 'media'
          ? { kind: 'media', alt: ctx.subject.media.alt, query: ctx.subject.query }
          : ctx.subject,
      // The still frame, so the model writes about the picture rather than its
      // title. Only sent in caption mode, which is the one job that needs eyes.
      ...(ctx.subject.kind === 'media' ? { image: ctx.subject.media.src } : {}),
      bots: ctx.bots.map((bot) => ({ id: bot.id, difficulty: bot.difficulty })),
    })

    const out = new Map<PlayerId, EntryAnswer>()
    const rows = answer.answers ?? {}

    // Caption mode is words only — nothing to fetch, so it is done here.
    const needBoards: { id: PlayerId; query: string }[] = []
    for (const bot of ctx.bots) {
      const row = rows[bot.id]
      if (!row) continue
      if ('lines' in row) out.set(bot.id, { kind: 'caption', lines: row.lines })
      else needBoards.push({ id: bot.id, query: row.query })
    }
    if (needBoards.length === 0) return out

    /**
     * **One board per distinct query, fetched at once.**
     *
     * This used to be a board per bot, sequentially, to avoid bursting the
     * provider — and it cost a round: nineteen bots meant nineteen round trips
     * in series while the compose clock ran. Every bot is answering the *same*
     * prompt, so their queries collapse hard; deduping usually leaves one or
     * two, and fetching those together costs one round trip rather than N.
     *
     * Variety comes from where a bot reads in the board rather than from
     * having its own — bot *n* takes result *n*, which is the same rule that
     * stops two bots answering with the same GIF.
     */
    const queries = [...new Set(needBoards.map((row) => row.query))]
    const boards = new Map<string, Awaited<ReturnType<typeof boardFor>>>()
    await Promise.all(
      queries.map(async (query) => {
        boards.set(query, await boardFor(query))
      }),
    )

    const taken = new Map<string, number>()
    for (const row of needBoards) {
      const board = boards.get(row.query) ?? []
      // Offset within the board this bot's query produced, so two bots that
      // asked the same thing still answer differently.
      const nth = taken.get(row.query) ?? 0
      taken.set(row.query, nth + 1)
      out.set(row.id, { kind: 'media', media: pickFrom(board, ctx.roundNumber + nth) })
    }
    return out
  },

  async ballots(ctx: BallotsContext): Promise<ReadonlyMap<PlayerId, Ballot>> {
    const answer = await ask({
      kind: 'ballots',
      mode: ctx.mode,
      roundNumber: ctx.roundNumber,
      voting: ctx.voting,
      places: ctx.places,
      // Text only. The cards carry no authorship — `project()` stripped it —
      // and this is where that stops being incidental and becomes the wire.
      cards: ctx.cards.map((card) => ({ entryId: card.entryId, text: card.text })),
      bots: ctx.bots.map((bot) => ({ id: bot.id, difficulty: bot.difficulty })),
    })
    return new Map(Object.entries(answer.ballots ?? {}))
  },
}
