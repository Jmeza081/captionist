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
    blurb: 'Chronically online. Knows every format, gets the obscure ones, never explains the joke.',
    brief:
      'You are chronically online — the one who gets every reference because ' +
      'you have never once put the phone down. You speak fluent meme: image ' +
      'macros, reaction captions, deep-cut formats, and you would rather die ' +
      'than explain a joke. Deadpan, lowercase energy, brutal. Most of your ' +
      'best lines are under six words.',
    delayMs: 2_500,
    taste: 'rotate',
  },
  senior: {
    id: 'senior',
    label: 'Senior',
    tag: 'Even',
    blurb: 'Knows the memes. About a year behind on them.',
    brief:
      'You know the formats and you are about a year behind on them, with a ' +
      'working instinct for self-preservation. Dry and short. You land the ' +
      'joke and you do not linger on it.',
    delayMs: 6_000,
    taste: 'rotate',
  },
  principal: {
    id: 'principal',
    label: 'Principal',
    tag: 'Diplomatic',
    blurb: 'How do you do, fellow kids. Uses the format wrong and explains it anyway.',
    brief:
      'You have been media-trained and you learned about memes from a slide ' +
      'deck. You use a format almost right, hedge it, and then explain it. You ' +
      'reach for "learnings". You are funny only by accident, and never on ' +
      'purpose.',
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
  'no punching down. A caption here is a *meme* caption: a handful of words, ' +
  'never a sentence that needs a comma, never an explanation. If it would not ' +
  'fit in Impact font across the top of the image, it is too long.'
