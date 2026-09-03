import type { BotDifficulty } from './types'

/**
 * What each level actually changes. Data only — no prompts are built here and
 * nothing fetches, so `BotPicker` can import this without importing a client.
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
   * How it ranks without a model. `rotate` is today's positional behaviour;
   * `first` takes the board in order, which reads as an intern not thinking.
   */
  taste: 'first' | 'rotate'
}

export const PERSONAS: Readonly<Record<BotDifficulty, BotPersona>> = {
  intern: {
    id: 'intern',
    label: 'Intern',
    tag: 'Gentle',
    blurb: 'Writes the first thing that comes to mind. Funny about a third of the time.',
    brief:
      'You are an eager junior engineer three weeks into the job. Go for the ' +
      'obvious joke and commit to it. Occasionally miss.',
    delayMs: 2_500,
    taste: 'first',
  },
  senior: {
    id: 'senior',
    label: 'Senior',
    tag: 'Even',
    blurb: 'Reads the room. Will not embarrass you in front of the new hire.',
    brief:
      'You are a senior engineer with good timing. Understated, specific, and ' +
      'never trying too hard.',
    delayMs: 6_000,
    taste: 'rotate',
  },
  principal: {
    id: 'principal',
    label: 'Principal',
    tag: 'Ruthless',
    blurb: 'Ruthless. Has seen this outage before and still finds it funny.',
    brief:
      'You are a principal engineer who has survived every outage on the ' +
      'roadmap. Dry, merciless, and economical. The best line in the room.',
    delayMs: 9_000,
    taste: 'rotate',
  },
}

/** The default a picker opens on. Even, and the one most rooms want. */
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
