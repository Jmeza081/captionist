import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { verifySeat } from '@/lib/ably/seat'
import { systemPrompt, userPrompt, type TurnRequest } from '@/lib/bots/prompt'
import { isBotDifficulty } from '@/lib/bots/types'

/**
 * A bot's turn, written by a model.
 *
 * **The one key in this app that cannot be public.** Both GIF keys ship to the
 * browser by necessity — the providers forbid a proxy (ADR 0020, ADR 0022) —
 * and nothing forbids one here, so nothing justifies handing a model key to
 * twenty browsers. That is the whole reason this route exists, and it is why
 * ADR 0020's deletion of `/api/gifs` is not contradicted by it.
 *
 * The seat arrives signed or it does not arrive. `/api/ably/token` established
 * that boundary and this reuses it verbatim: an unsigned request is a 403,
 * because an ungated route that proxies a model is a free-token faucet for
 * anyone who finds the URL.
 *
 * **Batched.** One call answers for every bot in the phase. That is what keeps
 * a five-round game at cents rather than dollars, and it is also the only way
 * to ask for lines that differ from each other.
 */

/**
 * Which model does which job — and they are not the same job.
 *
 * **Writing a caption is the only one that has to be funny**, and comedy is
 * precisely where model size shows. It is also the only one with an image
 * attached. Everything else is constrained extraction — a two-to-four word
 * search query, or a ranking of ids — which a small fast model does as well as
 * a large one and for a fifth of the price.
 *
 * The split is roughly $0.064 a game against $0.088 all-Opus and $0.018
 * all-Haiku: about three quarters of the top price for effectively all of the
 * quality, because the cheap jobs were never the ones carrying it.
 */
const FUNNY_MODEL = 'claude-opus-5'
const FAST_MODEL = 'claude-haiku-4-5'

function modelFor(body: TurnRequest): string {
  return body.kind === 'answers' && body.mode === 'caption' ? FUNNY_MODEL : FAST_MODEL
}

// Short by design: a caption is one line and a ballot is a list of ids.
// Nothing here should ever approach a cap, and a low one bounds a runaway.
const MAX_TOKENS = 1_024

/**
 * A crude per-seat throttle, in memory.
 *
 * Not the spend cap — that is a monthly limit on the Anthropic workspace,
 * which no bug here can exceed. This is the faster guard: a limit measured in
 * months cannot notice a loop that burns a budget in an hour.
 *
 * Per instance and lost on redeploy, which is honest about what it is: a
 * circuit breaker, not an accounting system.
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30
const hits = new Map<string, number[]>()

function throttled(seat: string, now: number): boolean {
  const recent = (hits.get(seat) ?? []).filter((at) => now - at < WINDOW_MS)
  recent.push(now)
  hits.set(seat, recent)
  return recent.length > MAX_PER_WINDOW
}

/**
 * The longest a caption line may be, in characters.
 *
 * Enforced in `shape()`, **not in the schema.** Structured outputs reject
 * `maxLength`, `minLength`, `minItems` and `maxItems` outright — a 400 from
 * the API that this route turned into a 502, which took every bot in every
 * mode down to the corpus for a whole live session. The prompt does the real
 * work of keeping lines short; this is the backstop that catches a paragraph,
 * and a line that trips it is dropped so the corpus fills the seat.
 */
const LINE_MAX = 100

/**
 * The shapes the model may answer in. Structured, so nothing is parsed out of
 * prose — and **built per request**, so the ids are an `enum` of exactly the
 * bots asked for.
 *
 * `id: { type: 'string' }` was the react-mode timeout. Haiku would echo an id
 * loosely — `bot_1`, `1`, a nickname — the route dropped the row as unknown,
 * and the bot it belonged to never acted. An enum makes a wrong id impossible
 * rather than merely unlikely; the pool's corpus fallback is the net under it,
 * not the road.
 *
 * **Only what structured outputs supports.** Types, `enum`, `required` and
 * `additionalProperties: false`. No length or count constraints — those are
 * validated in `shape()` instead, because the API refuses them.
 *
 * A new id set is a new schema, and a new schema pays a one-time compilation
 * on its first request (cached for 24h after). A room's bots are stable, so
 * that is once per room per kind, not once per round.
 */
function schemaFor(kind: TurnRequest['kind'], ids: readonly string[]) {
  const id = ids.length > 0 ? { type: 'string' as const, enum: [...ids] } : { type: 'string' as const }
  const lines = { type: 'array' as const, items: { type: 'string' as const } }
  switch (kind) {
    case 'subject':
      return {
        type: 'object' as const,
        properties: { text: { type: 'string' as const } },
        required: ['text'],
        additionalProperties: false,
      }
    case 'answers':
      return {
        type: 'object' as const,
        properties: {
          answers: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: { id, lines },
              required: ['id', 'lines'],
              additionalProperties: false,
            },
          },
        },
        required: ['answers'],
        additionalProperties: false,
      }
    case 'ballots':
      return {
        type: 'object' as const,
        properties: {
          ballots: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                id,
                ranked: { type: 'array' as const, items: { type: 'string' as const } },
              },
              required: ['id', 'ranked'],
              additionalProperties: false,
            },
          },
        },
        required: ['ballots'],
        additionalProperties: false,
      }
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const production = process.env.NODE_ENV === 'production'

  let body: (TurnRequest & { seat?: string; sig?: string }) | undefined
  try {
    body = (await request.json()) as TurnRequest & { seat?: string; sig?: string }
  } catch {
    return NextResponse.json({ error: 'That request isn’t readable.' }, { status: 400 })
  }

  // **The whole boundary.** Signed by the same secret `/api/ably/seat` mints
  // with, so a tab that holds a seat already holds the right to ask.
  const seatSecret = process.env.ABLY_API_KEY ?? 'captionist-stub-secret'
  const { seat, sig } = body
  if (!seat || !sig || !verifySeat(seat, sig, seatSecret)) {
    return NextResponse.json(
      { error: 'That seat isn’t yours. Reload to be given one.' },
      { status: 403 },
    )
  }

  if (throttled(seat, Date.now())) {
    return NextResponse.json(
      { error: 'That’s a lot of bots at once. Wait a moment.' },
      { status: 429 },
    )
  }

  // No key is not an error outside production — a fresh clone should play,
  // with written-in jokes, the way a keyless picker still draws a board. The
  // client reads this flag and stops asking. Mirrors `/api/ably/seat`.
  if (!apiKey) {
    if (production) {
      return NextResponse.json(
        { error: 'Bots aren’t configured. Set ANTHROPIC_API_KEY and redeploy.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ stub: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const bots = (body.bots ?? []).filter((bot) => isBotDifficulty(bot.difficulty))
  if (body.kind !== 'subject' && bots.length === 0) {
    return NextResponse.json({ error: 'No bots were named.' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey })
    const schema = schemaFor(body.kind, bots.map((bot) => bot.id))

    // The image goes first, ahead of the text — the order the vision docs ask
    // for. One image per call, because every bot captions the same GIF, which
    // is most of why batching is cheap rather than merely tidy.
    const content: Anthropic.ContentBlockParam[] = []
    if (body.image && body.kind === 'answers' && body.mode === 'caption') {
      content.push({ type: 'image', source: { type: 'url', url: body.image } })
    }
    content.push({ type: 'text', text: userPrompt(body) })

    const model = modelFor(body)
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(bots.length > 0 ? bots : [{ id: 'bot', difficulty: 'senior' }]),
      output_config: {
        format: { type: 'json_schema', schema },
        // **Effort only on the model that has it.** Opus 5 thinks by default;
        // `low` is right for a one-liner, which needs wit rather than
        // deliberation. Haiku 4.5 predates the parameter and *rejects* it, so
        // it must not be sent there — and its older `budget_tokens` form would
        // buy nothing for a search query.
        ...(model === FUNNY_MODEL ? { effort: 'low' as const } : {}),
      },
      messages: [{ role: 'user', content }],
    })

    const text = response.content.find((block) => block.type === 'text')
    const parsed: unknown = text && text.type === 'text' ? JSON.parse(text.text) : {}

    return NextResponse.json(
      {
        ...shape(body, parsed),
        // Reported back so the host can keep its own running total and trip a
        // few cents before the workspace's own limit does.
        usage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          // Which model, because the two are priced five times apart and the
          // host's tally would be wrong for whichever one it assumed.
          model,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[api/bots/turn] failed', error)
    // **Say why, outside production.** The upstream reason used to reach only
    // the dev server's terminal, and a 502 in the browser console said nothing
    // — which cost a live session to a rejected schema that one line here
    // would have named. Never in production: an upstream error message is not
    // a player's business, and can carry more than it should.
    const detail =
      !production && error instanceof Error ? { detail: error.message } : {}
    return NextResponse.json(
      { error: 'The bots aren’t answering.', ...detail },
      { status: 502 },
    )
  }
}

/**
 * Turn the model's answer into the room's own vocabulary.
 *
 * Deliberately not the model's job. Asking it for a `RoundSubject` would put a
 * wire type in a prompt, where a rename becomes a silent runtime failure
 * instead of a compile error.
 */
function shape(body: TurnRequest, parsed: unknown): Record<string, unknown> {
  const data = (parsed ?? {}) as Record<string, unknown>

  if (body.kind === 'subject') {
    const text = typeof data.text === 'string' ? data.text.trim() : ''
    if (!text || text.length > LINE_MAX) return {}
    // A caption-mode subject is a *query*, not a GIF: the browser owns the
    // provider call, because that is where the key lives (ADR 0022).
    return body.mode === 'caption' ? { query: text } : { subject: { kind: 'prompt', text } }
  }

  if (body.kind === 'answers') {
    const rows = Array.isArray(data.answers) ? data.answers : []
    const out: Record<string, unknown> = {}
    for (const row of rows as { id?: unknown; lines?: unknown }[]) {
      if (typeof row.id !== 'string') continue
      const lines = Array.isArray(row.lines)
        ? row.lines
            .filter((line): line is string => typeof line === 'string')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            // Two at most — top and bottom. A third line is not a caption.
            .slice(0, 2)
        : []
      if (lines.length === 0) continue
      // A paragraph is not a meme caption. Dropping the row rather than
      // truncating it: a joke cut mid-sentence is worse than a written-in one,
      // and the pool fills any seat this leaves empty.
      if (lines.some((line) => line.length > LINE_MAX)) continue
      out[row.id] = body.mode === 'caption' ? { kind: 'caption', lines } : { query: lines[0] }
    }
    return { answers: out }
  }

  const rows = Array.isArray(data.ballots) ? data.ballots : []
  const out: Record<string, unknown> = {}
  const legal = new Set((body.cards ?? []).map((card) => card.entryId))
  for (const row of rows as { id?: unknown; ranked?: unknown }[]) {
    if (typeof row.id !== 'string') continue
    // **Every id checked against the board.** A hallucinated entry id would be
    // a ballot for a card that does not exist, which the reducer would take.
    const ranked = (Array.isArray(row.ranked) ? row.ranked : []).filter(
      (id): id is string => typeof id === 'string' && legal.has(id),
    )
    if (ranked.length === 0) continue
    out[row.id] =
      body.voting === 'single'
        ? { kind: 'single', choice: ranked[0] }
        : { kind: 'rank', ranked: ranked.slice(0, body.places ?? 3) }
  }
  return { ballots: out }
}
