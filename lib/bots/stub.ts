import { FALLBACK_PROMPTS, RANK_POINTS } from '@/lib/game/constants'
import type { Ballot, EntryAnswer, PlayerId, RoundSubject } from '@/lib/game/types'
import { sampleAt } from '@/lib/gifs/samples'
import { toMediaRef } from '@/lib/gifs/types'
import { personaFor } from './personas'
import type { AnswersContext, BallotsContext, BotBrain, SubjectContext } from './types'

/**
 * Written-in jokes. Offline, free, and the same every time.
 *
 * **Not a courtesy adapter.** Playwright's Chromium resolves nothing but the
 * dev server and a fresh clone has no key — the same two reasons `SAMPLE_GIFS`
 * exists — so this is the road the whole suite takes. It is also where a room
 * lands when the month's budget is spent, which is why an exhausted budget
 * costs a joke's quality and never a playable round.
 *
 * Every choice is positional, exactly as `BotDriver` was before the seam:
 * bot `n` writes caption `n` and ranks the grid rotated by `n`. That is what
 * lets `?seed=` reproduce a whole game and a spec name a card.
 */

const CAPTIONS: readonly string[] = [
  'Ship it, the tests are flaky anyway.',
  'Works on my machine, promoting to prod.',
  'I have no idea what this service does.',
  'Adding a comment instead of fixing it.',
  'This is technically a rollback.',
  'The linter and I have agreed to disagree.',
]

/** Second lines, for a room whose format asks for top *and* bottom. */
const BOTTOMS: readonly string[] = [
  'The pager disagrees.',
  'Nobody has reverted it yet.',
  'It is on the roadmap.',
  'Ask me again on Monday.',
  'The runbook is a haiku.',
  'That is a Q3 problem.',
]

/**
 * Async, but not slow.
 *
 * The written-in road resolves immediately and still returns a promise, so no
 * screen can assume synchrony — which was the whole point of `LocalTransport`
 * pretending to take 80ms. The *visible* pause a bot takes before acting lives
 * in `BotPool.dwell` instead, because that is the thing that knows the room's
 * clock and can be scaled by `?fast=` or switched off on a virtual one.
 */
function think(): Promise<void> {
  return Promise.resolve()
}

export const stubBrain: BotBrain = {
  id: 'stub',

  async subject(ctx: SubjectContext): Promise<RoundSubject> {
    await think()
    const n = ctx.roundNumber
    if (ctx.mode === 'caption') {
      // A real file under `public/`, so a bot's pick renders rather than
      // showing a broken frame. `toMediaRef` carries the shelf's own
      // dimensions, and a card is drawn at its image's ratio.
      return { kind: 'media', media: toMediaRef(sampleAt(n)) }
    }
    return {
      kind: 'prompt',
      text: FALLBACK_PROMPTS[n % FALLBACK_PROMPTS.length] ?? 'Describe the deploy.',
    }
  },

  async answers(ctx: AnswersContext): Promise<ReadonlyMap<PlayerId, EntryAnswer>> {
    await think()
    const out = new Map<PlayerId, EntryAnswer>()
    for (const bot of ctx.bots) {
      if (ctx.mode === 'caption') {
        const top = CAPTIONS[bot.index % CAPTIONS.length] ?? 'A caption.'
        // **The format bug, fixed.** The old driver returned one line whatever
        // the room asked for, so a `tb` room got half a caption from every bot.
        const lines =
          ctx.format === 'tb'
            ? [top, BOTTOMS[bot.index % BOTTOMS.length] ?? 'Still no notes.']
            : [top]
        out.set(bot.id, { kind: 'caption', lines })
      } else {
        // Offset by index so no two bots answer with the same GIF — a vote
        // grid showing the same card twice is a bug you only see with bots.
        out.set(bot.id, {
          kind: 'media',
          media: toMediaRef(sampleAt(ctx.roundNumber + bot.index)),
        })
      }
    }
    return out
  },

  async ballots(ctx: BallotsContext): Promise<ReadonlyMap<PlayerId, Ballot>> {
    await think()
    const out = new Map<PlayerId, Ballot>()
    for (const bot of ctx.bots) {
      const cards = ctx.cards
      if (cards.length === 0) continue

      // Rotate by index before ranking. Identical ballots are not "neutral":
      // they make every round a dead heat, so the tiebreak becomes the normal
      // path and the scoring path is barely exercised.
      const offset = personaFor(bot.difficulty).taste === 'first' ? 0 : bot.index % cards.length
      const ranked = [...cards.slice(offset), ...cards.slice(0, offset)]
        .slice(0, Math.min(ctx.places, RANK_POINTS.length))
        .map((card) => card.entryId)
      if (ranked.length === 0) continue

      out.set(
        bot.id,
        ctx.voting === 'single'
          ? { kind: 'single', choice: ranked[0] ?? '' }
          : { kind: 'rank', ranked },
      )
    }
    return out
  },
}
