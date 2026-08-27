import type { ActionInput } from '@/lib/game/actions'
import { FALLBACK_PROMPTS, RANK_POINTS } from '@/lib/game/constants'
import { hasSubmitted, hasVoted, isRoleHolder, voteCards } from '@/lib/game/selectors'
import type { EntryAnswer, PlayerId, PublicState, RoundSubject } from '@/lib/game/types'

/**
 * A scripted guest, so one page can play a full room.
 *
 * **Bots go through `sendIntent`, never straight into the reducer.** Driving
 * the reducer directly would be simpler and would exercise none of the path
 * that actually breaks — authorisation, ordering, the host's stamping of `at`.
 * A bot is deliberately indistinguishable from a person holding a phone.
 *
 * Every choice here is positional rather than random: bot `n` always writes
 * caption `n` and always ranks the grid in shuffle order. With `?seed=` fixing
 * the shuffle, a whole game is reproducible, which is what lets a Playwright
 * spec name a card.
 */

export interface BotDriverOptions {
  id: PlayerId
  name: string
  /** Stable position, used for every deterministic choice this bot makes. */
  index: number
  send: (action: ActionInput) => void
}

const CAPTIONS: readonly string[] = [
  'Ship it, the tests are flaky anyway.',
  'Works on my machine, promoting to prod.',
  'I have no idea what this service does.',
  'Adding a comment instead of fixing it.',
  'This is technically a rollback.',
  'The linter and I have agreed to disagree.',
]

export class BotDriver {
  private readonly options: BotDriverOptions
  /** One action per phase per round. Re-broadcasts must not re-submit. */
  private readonly done = new Set<string>()
  private joined = false

  constructor(options: BotDriverOptions) {
    this.options = options
  }

  /** Wire to a `GuestClient`'s state callback. */
  observe = (state: PublicState): void => {
    const { id } = this.options

    if (!state.players.some((p) => p.id === id)) {
      // Only try once: the join is in flight until the next broadcast shows it.
      if (this.joined) return
      this.joined = true
      this.options.send({
        type: 'player/joined',
        player: { id, name: this.options.name, avatarSeed: id },
      })
      return
    }

    const key = `${state.roundNumber}:${state.phase}`
    if (this.done.has(key)) return

    const action = this.actionFor(state)
    if (!action) return
    this.done.add(key)
    this.options.send(action)
  }

  private actionFor(state: PublicState): ActionInput | undefined {
    const { id, index } = this.options

    switch (state.phase) {
      case 'brief':
        if (!isRoleHolder(state, id)) return undefined
        return { type: 'round/subjectLocked', subject: this.subjectFor(state) }

      case 'compose':
        // The role holder set the round up and sits it out.
        if (isRoleHolder(state, id) || hasSubmitted(state, id)) return undefined
        return { type: 'round/entrySubmitted', answer: this.answerFor(state) }

      case 'vote': {
        if (hasVoted(state, id)) return undefined
        const others = voteCards(state, id).filter((card) => !card.own)
        // Rotate by index before ranking. Identical ballots are not "neutral":
        // they make every round a dead heat, so the tiebreak becomes the normal
        // path and the scoring path is barely exercised.
        const offset = others.length > 0 ? this.options.index % others.length : 0
        const ranked = [...others.slice(offset), ...others.slice(0, offset)]
          .slice(0, RANK_POINTS.length)
          .map((card) => card.entryId)
        if (ranked.length === 0) return undefined
        return state.settings.voting === 'single'
          ? { type: 'round/ballotCast', ballot: { kind: 'single', choice: ranked[0] ?? '' } }
          : { type: 'round/ballotCast', ballot: { kind: 'rank', ranked } }
      }

      case 'tiebreak': {
        const tiebreak = state.round?.tiebreak
        if (!tiebreak || tiebreak.votes[id] !== undefined) return undefined
        // Rotate by index so bots do not all break the tie the same way.
        const choice = tiebreak.contenders[index % tiebreak.contenders.length]
        return choice ? { type: 'round/tiebreakVoted', choice } : undefined
      }

      default:
        return undefined
    }
  }

  private subjectFor(state: PublicState): RoundSubject {
    const n = state.roundNumber
    if (state.settings.mode === 'caption') {
      // A URL, never a data URI — see the invariant in `types.ts`.
      return {
        kind: 'media',
        media: { src: `/media/round-${n}.gif`, alt: `Round ${n} subject`, source: 'giphy' },
      }
    }
    return {
      kind: 'prompt',
      text: FALLBACK_PROMPTS[n % FALLBACK_PROMPTS.length] ?? 'Describe the deploy.',
    }
  }

  private answerFor(state: PublicState): EntryAnswer {
    const { index } = this.options
    if (state.settings.mode === 'caption') {
      return { kind: 'caption', lines: [CAPTIONS[index % CAPTIONS.length] ?? 'A caption.'] }
    }
    return {
      kind: 'media',
      media: {
        src: `/media/answer-${state.roundNumber}-${index}.gif`,
        alt: `${this.options.name}'s answer`,
        source: 'giphy',
      },
    }
  }
}
