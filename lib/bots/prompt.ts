import { HOUSE_RULES, personaFor } from './personas'
import type { BotDifficulty } from './types'

/**
 * The words sent to the model, built server-side.
 *
 * Kept out of the route handler so the shapes can be unit-tested without a key
 * and without a request, and kept out of the client bundle because nothing in
 * the browser has any business knowing what a bot is told.
 */

/** What the browser is allowed to ask for. Narrowed before anything is built. */
export interface TurnRequest {
  kind: 'subject' | 'answers' | 'ballots'
  mode: 'caption' | 'react'
  format?: 'tb' | 'one'
  roundNumber: number
  voting?: 'rank' | 'single'
  places?: number
  subject?: { kind: 'media'; alt?: string; query?: string } | { kind: 'prompt'; text: string }
  /** Still-frame URL, when there is one to look at. */
  image?: string
  bots?: readonly { id: string; difficulty: BotDifficulty }[]
  cards?: readonly { entryId: string; text: string }[]
}

/**
 * The system prompt.
 *
 * One brief per bot rather than one call per bot: the model is told it is
 * writing for several distinct voices at once, which is the only way to ask
 * for lines that differ from each other. N independent calls cannot see what
 * the others wrote and reliably converge on the same joke.
 */
export function systemPrompt(bots: readonly { id: string; difficulty: BotDifficulty }[]): string {
  const voices = bots
    .map((bot) => `- ${bot.id}: ${personaFor(bot.difficulty).brief}`)
    .join('\n')

  return [
    'You are writing for a party game played by an engineering team.',
    'The voice is dry, specific and understated — the tone of a good standup, not a comedy club.',
    '',
    HOUSE_RULES,
    '',
    // **No names reach here.** The browser sends seat ids and levels, and the
    // projection the bots read has already stripped authorship — so a joke
    // about a person is not discouraged, it is unavailable.
    'You are writing for these players. Give each one a distinctly different line:',
    voices,
  ].join('\n')
}

/** One line per job, describing what to write. */
export function userPrompt(request: TurnRequest): string {
  const lines: string[] = []

  switch (request.kind) {
    case 'subject':
      if (request.mode === 'caption') {
        lines.push(
          'Suggest a GIF search query for this round. Two to four words, the kind of',
          'thing that returns a widely recognised reaction GIF. Reply with the query only.',
        )
      } else {
        lines.push(
          'Write a one-sentence prompt for the other players to answer with a GIF.',
          'Something an engineering team has lived through. Reply with the sentence only.',
        )
      }
      break

    case 'answers':
      if (request.mode === 'caption') {
        lines.push(
          request.format === 'tb'
            ? 'Write a two-line caption for this image: a setup and a punchline.'
            : 'Write a one-line caption for this image.',
        )
        if (request.subject?.kind === 'media') {
          if (request.subject.alt) lines.push(`The GIF is titled: ${request.subject.alt}`)
          // What a person searched to find it — the closest thing to a
          // statement of the joke they were going for.
          if (request.subject.query) lines.push(`It was found by searching: ${request.subject.query}`)
        }
      } else {
        lines.push(
          'Suggest a GIF search query that answers the prompt below. Two to four words.',
          request.subject?.kind === 'prompt' ? `The prompt is: ${request.subject.text}` : '',
        )
      }
      break

    case 'ballots':
      lines.push(
        request.voting === 'single'
          ? 'Pick the single funniest entry.'
          : `Rank the ${request.places ?? 3} funniest entries, best first.`,
        'Judge the writing, not the length. Reward specificity over volume.',
        '',
        'The entries:',
        ...(request.cards ?? []).map((card) => `- ${card.entryId}: ${card.text}`),
      )
      break
  }

  return lines.filter(Boolean).join('\n')
}
