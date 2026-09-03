import type { Ballot, EntryAnswer, PlayerId, RoundSubject } from '@/lib/game/types'
import { fetchBoard } from '@/lib/gifs/source'
import { toMediaRef } from '@/lib/gifs/types'
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
  usage?: { input: number; output: number }
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
  if (parsed.usage) recordSpend(parsed.usage.input, parsed.usage.output)
  if (parsed.stub) throw new BotRouteError('No model key is configured.')
  return parsed
}

/**
 * A query becomes a picture.
 *
 * `pick` offsets into the board so no two bots answer with the same GIF — a
 * vote grid showing the same card twice is a bug you only ever see with bots.
 * A board that comes back short or empty falls to the offline shelf rather
 * than leaving a round with no subject.
 */
async function gifFor(query: string, pick: number): Promise<ReturnType<typeof toMediaRef>> {
  try {
    const board = await fetchBoard(query, undefined, BOARD_SIZE)
    const chosen = board.results[pick % Math.max(1, board.results.length)]
    if (chosen) return toMediaRef(chosen)
  } catch {
    // A provider that is down must not take the round with it.
  }
  return toMediaRef(sampleAt(pick))
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
    // Sequential rather than `Promise.all`: react mode turns each query into a
    // board, and firing nineteen searches at once is exactly the burst the
    // provider's rate limit is there to refuse.
    let pick = 0
    for (const bot of ctx.bots) {
      const row = rows[bot.id]
      if (!row) continue
      if ('lines' in row) {
        out.set(bot.id, { kind: 'caption', lines: row.lines })
        continue
      }
      const media = await gifFor(row.query, ctx.roundNumber + pick)
      pick += 1
      out.set(bot.id, { kind: 'media', media })
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
