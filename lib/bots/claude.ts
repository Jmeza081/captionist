import type { Ballot, EntryAnswer, PlayerId, RoundSubject } from '@/lib/game/types'
import { readSeat, readSeatSignature } from '@/lib/room/identity'
import { recordSpend } from './budget'
import type { AnswersContext, BallotsContext, BotBrain, SubjectContext } from './types'

/**
 * The model, reached through our own route.
 *
 * The route exists because this is the first key in the app that **cannot** be
 * public. Both GIF keys ship to the browser by necessity — the providers
 * forbid a proxy (ADR 0020, ADR 0022) — and nothing forbids one here, so
 * nothing justifies handing a model key to twenty browsers.
 *
 * Every call carries the seat the server signed. An unsigned request is a 403,
 * which is the whole boundary between the key and the open internet.
 */

/** What the route answers with, before it is narrowed. */
interface TurnResponse {
  subject?: RoundSubject
  answers?: Record<PlayerId, EntryAnswer>
  ballots?: Record<PlayerId, Ballot>
  /** Reported back so the host can keep its own running total. */
  usage?: { input: number; output: number }
  /** True when the server has no key, so the caller stops asking. */
  stub?: boolean
}

class BotRouteError extends Error {}

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

  if (!response.ok) {
    throw new BotRouteError(`The bot route answered ${response.status}.`)
  }

  const parsed = (await response.json()) as TurnResponse
  if (parsed.usage) recordSpend(parsed.usage.input, parsed.usage.output)
  if (parsed.stub) throw new BotRouteError('No model key is configured.')
  return parsed
}

function toMap<T>(record: Record<PlayerId, T> | undefined): ReadonlyMap<PlayerId, T> {
  return new Map(Object.entries(record ?? {}))
}

export const claudeBrain: BotBrain = {
  id: 'claude',

  async subject(ctx: SubjectContext): Promise<RoundSubject> {
    const { subject } = await ask({
      kind: 'subject',
      difficulty: ctx.bot.difficulty,
      mode: ctx.mode,
      roundNumber: ctx.roundNumber,
    })
    if (!subject) throw new BotRouteError('The route returned no subject.')
    return subject
  },

  async answers(ctx: AnswersContext): Promise<ReadonlyMap<PlayerId, EntryAnswer>> {
    const { answers } = await ask({
      kind: 'answers',
      mode: ctx.mode,
      format: ctx.format,
      roundNumber: ctx.roundNumber,
      subject: ctx.subject,
      // Ids and levels only. **No names travel** — not the bots' and certainly
      // not the room's, which is what keeps a joke about a person impossible
      // rather than merely discouraged.
      bots: ctx.bots.map((bot) => ({ id: bot.id, difficulty: bot.difficulty })),
    })
    return toMap(answers)
  },

  async ballots(ctx: BallotsContext): Promise<ReadonlyMap<PlayerId, Ballot>> {
    const { ballots } = await ask({
      kind: 'ballots',
      mode: ctx.mode,
      roundNumber: ctx.roundNumber,
      voting: ctx.voting,
      places: ctx.places,
      cards: ctx.cards,
      bots: ctx.bots.map((bot) => ({ id: bot.id, difficulty: bot.difficulty })),
    })
    return toMap(ballots)
  },
}
