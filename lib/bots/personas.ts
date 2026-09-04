import type { BotDifficulty } from './types'

/**
 * What each level actually changes. Data only — no prompts are built here and
 * nothing fetches, so `BotPicker` can import this without importing a client.
 *
 * **The ladder runs the other way to the seniority.** An intern has not yet
 * learned what they cannot say, and a principal has been media-trained — so
 * hiring a Principal is the *easy* setting. The names are in career order
 * because that ordering is the joke; the difficulty descends through it.
 *
 * Four axes, and they are deliberately not "a temperature":
 *
 * 1. `brief` — the voice the model is asked to write in.
 * 2. `delayMs` — how long the bot sits before acting. Bots see a broadcast
 *    instantly and would otherwise slam every phase gate shut before a person
 *    has finished reading the GIF.
 * 3. `taste` — how a ballot is cast when the model is not available.
 * 4. `rank` — where its own board pick comes from, so two bots never collide.
 */
export interface BotPersona {
  id: BotDifficulty
  /** Sentence case, verb-free — this is a name, not an action. */
  label: string
  /** The line under the label in `BotPicker`. One sentence, dry. */
  blurb: string
  /** The tag beside the label. */
  tag: string
  /** The voice, handed to the model as part of the system prompt. */
  brief: string
  /** How long it waits before acting, in room time. */
  delayMs: number
  /**
   * How it ranks without a model. `rotate` offsets by seat so ballots differ;
   * `first` takes the board in order, which reads as somebody who deliberated
   * at length and then picked the obvious one.
   */
  taste: 'first' | 'rotate'
}

export const PERSONAS: Readonly<Record<BotDifficulty, BotPersona>> = {
  intern: {
    id: 'intern',
    label: 'Intern',
    tag: 'Ruthless',
    blurb: 'Has not learned what you cannot say yet. Fastest and funniest thing in the room.',
    brief:
      'You are three weeks into your first job and have not yet learned which ' +
      'jokes end up in a retro. Fast, unfiltered, and genuinely funny. Go for ' +
      'the line the room will still be quoting on Friday.',
    delayMs: 2_500,
    taste: 'rotate',
  },
  senior: {
    id: 'senior',
    label: 'Senior',
    tag: 'Even',
    blurb: 'Still funny, and has learned which jokes end up in a retro.',
    brief:
      'You are a senior engineer with good timing and a working instinct for ' +
      'self-preservation. Understated, specific, and never trying too hard.',
    delayMs: 6_000,
    taste: 'rotate',
  },
  principal: {
    id: 'principal',
    label: 'Principal',
    tag: 'Diplomatic',
    blurb: 'Writes captions like postmortems. Blameless, thorough, not funny.',
    brief:
      'You have been media-trained. Every joke is hedged, scoped and made ' +
      'blameless before it leaves your mouth. Reach for "learnings" and ' +
      '"action items". You are only funny by accident, and never on purpose.',
    delayMs: 9_000,
    // Takes the first thing on the board. Deliberating for nine seconds and
    // then picking the obvious one is the whole character.
    taste: 'first',
  },
}

/** The default a picker opens on. The middle of the ladder, and the safe pick. */
export const DEFAULT_DIFFICULTY: BotDifficulty = 'senior'

export function personaFor(difficulty: BotDifficulty): BotPersona {
  return PERSONAS[difficulty]
}

/**
 * The rule every bot writes under, whatever its level.
 *
 * **Bots never receive player names**, so a bot cannot write about a person
 * even if asked to — but the instruction is here as well, because the room is
 * for colleagues and one cruel line lands differently than a cruel line about
 * a picture.
 */
export const HOUSE_RULES =
  'Roast the situation in the picture, never a person. No slurs, no politics, ' +
  'no punching down. Keep it to one line a team would repeat in standup.'
