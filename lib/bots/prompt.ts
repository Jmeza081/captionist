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
    'You are writing for a meme-caption party game played by an engineering team.',
    '',
    HOUSE_RULES,
    '',
    WHAT_A_CAPTION_IS,
    '',
    // **No names reach here.** The browser sends seat ids and levels, and the
    // projection the bots read has already stripped authorship — so a joke
    // about a person is not discouraged, it is unavailable.
    'You are writing for these players. Give each one a distinctly different line, in their own voice:',
    voices,
  ].join('\n')
}

/**
 * What the model is actually being asked to make.
 *
 * Asked for "a one-line caption", it wrote paragraphs — grammatical, hedged,
 * and self-explaining. A meme caption is none of those things. The examples do
 * more than the rules: a register is easier to copy than to describe, and the
 * one marked bad is verbatim the shape that came back before this existed.
 */
const WHAT_A_CAPTION_IS = [
  'What a caption is here: the picture does the work, the words are the twist.',
  '- Short. Most good ones are under eight words. Under forty characters.',
  '- One beat. The image is the setup; you only supply the payoff.',
  '- Deadpan. Lowercase is fine. No exclamation marks, no emoji, no hashtags.',
  '- Never describe the image. Never explain the joke. Never say "when you realize".',
  '- Formats that work: "nobody: / me:", "POV:", "me when", a flat statement, a single word.',
  '',
  'Good:',
  '- works on my machine',
  '- nobody: / the linter:',
  '- POV: the intern found the prod credentials',
  '- it\'s a feature',
  '- this you?',
  '- we\'ll fix it in the retro',
  '- rollback is a deploy with better instincts',
  '',
  'Bad — too long, and it explains itself:',
  '- When you realize that the deployment you pushed on Friday afternoon is now',
  '  causing issues in production and everyone in the channel is looking at you',
].join('\n')

/** One line per job, describing what to write. */
export function userPrompt(request: TurnRequest): string {
  const lines: string[] = []

  switch (request.kind) {
    case 'subject':
      if (request.mode === 'caption') {
        lines.push(
          'Suggest a GIF search query for this round. Two to four words that return a',
          'widely recognised reaction GIF. Name the *reaction*, not the topic — "nervous',
          'sweating", not "deployment anxiety". Reply with the query only.',
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
            ? 'Write TOP text and BOTTOM text for this image, image-macro style: the top ' +
                'sets up, the bottom pays off. A few words each, in Impact-font energy.'
            : 'Write one meme caption for this image. A handful of words. No sentence.',
        )
        if (request.subject?.kind === 'media') {
          if (request.subject.alt) lines.push(`The GIF is titled: ${request.subject.alt}`)
          // What a person searched to find it — the closest thing to a
          // statement of the joke they were going for.
          if (request.subject.query) lines.push(`It was found by searching: ${request.subject.query}`)
        }
      } else {
        lines.push(
          'Suggest a GIF search query that *answers* the prompt below, as a reaction image',
          'would. Two to four words. Name the reaction, not the topic — "slow clap", not',
          '"sarcastic approval of the plan".',
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
