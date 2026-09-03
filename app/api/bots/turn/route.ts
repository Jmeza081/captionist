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

const MODEL = 'claude-haiku-4-5'
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

/** The shapes the model may answer in. Structured, so nothing is parsed out of prose. */
const SCHEMAS = {
  subject: {
    type: 'object' as const,
    properties: { text: { type: 'string' as const } },
    required: ['text'],
    additionalProperties: false,
  },
  answers: {
    type: 'object' as const,
    properties: {
      answers: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            lines: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: ['id', 'lines'],
          additionalProperties: false,
        },
      },
    },
    required: ['answers'],
    additionalProperties: false,
  },
  ballots: {
    type: 'object' as const,
    properties: {
      ballots: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            ranked: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: ['id', 'ranked'],
          additionalProperties: false,
        },
      },
    },
    required: ['ballots'],
    additionalProperties: false,
  },
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
    const schema = SCHEMAS[body.kind]

    // The image goes first, ahead of the text — the order the vision docs ask
    // for. One image per call, because every bot captions the same GIF, which
    // is most of why batching is cheap rather than merely tidy.
    const content: Anthropic.ContentBlockParam[] = []
    if (body.image && body.kind === 'answers' && body.mode === 'caption') {
      content.push({ type: 'image', source: { type: 'url', url: body.image } })
    }
    content.push({ type: 'text', text: userPrompt(body) })

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // **No `thinking` and no `effort`.** Haiku 4.5 predates adaptive
      // thinking: `output_config.effort` is rejected on it, and the older
      // `budget_tokens` form would buy nothing for a one-line caption.
      system: systemPrompt(bots.length > 0 ? bots : [{ id: 'bot', difficulty: 'senior' }]),
      output_config: { format: { type: 'json_schema', schema } },
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
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[api/bots/turn] failed', error)
    return NextResponse.json({ error: 'The bots aren’t answering.' }, { status: 502 })
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
    if (!text) return {}
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
        ? row.lines.filter((line): line is string => typeof line === 'string')
        : []
      if (lines.length === 0) continue
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
