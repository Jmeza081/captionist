import type { ModalStep } from '@/components/molecules/Modal'
import { isRoleHolder, roleHolder } from '@/lib/game/selectors'
import type { GameMode, GameState, PlayerId } from '@/lib/game/types'

/**
 * Copy the shell owns, as opposed to any one screen.
 *
 * Branched by mode here for the same reason the selectors are: the round
 * opener is the one place the mode is restated mid-game, and a component that
 * picks its own strings by mode has already forked.
 */

export interface OpenerCopy {
  headline: string
  subline: string
}

/** The interstitial before each round — who is up, and what everyone else does. */
export function openerCopy(state: GameState, viewerId: PlayerId): OpenerCopy {
  const mode = state.settings.mode
  const holder = roleHolder(state)
  const mine = holder ? isRoleHolder(state, viewerId) : false
  const name = mine ? 'You' : (holder?.name ?? 'Someone')

  if (mode === 'caption') {
    return {
      headline: mine ? 'You pick the image.' : `${name} picks the image.`,
      subline: mine
        ? 'Everyone else fights over the caption. You sit this one out, then vote.'
        : 'You write the caption. Best three take the points.',
    }
  }

  return {
    headline: mine ? 'You write the prompt.' : `${name} writes the prompt.`,
    subline: mine
      ? 'Everyone else answers it with a GIF. You sit this one out, then vote.'
      : 'You answer it with a GIF. Best three take the points.',
  }
}

/**
 * The help walkthrough. Four steps, one per beat of a round, so a player who
 * joined mid-session can catch up without anyone explaining it out loud.
 */
export const HELP_STEPS: Readonly<Record<GameMode, ModalStep[]>> = {
  caption: [
    {
      eyebrow: 'Step 1',
      heading: 'Someone picks the image',
      body: 'Each round one player is the Captionist. They pick a GIF and then sit the round out — they do not compete against the captions they set up.',
    },
    {
      eyebrow: 'Step 2',
      heading: 'Everyone else captions it',
      body: 'You get a top and a bottom line, 60 characters each. Entries are anonymous until the reveal, so write the one you would not sign.',
    },
    {
      eyebrow: 'Step 3',
      heading: 'The room ranks the top three',
      body: 'Three points for first, two for second, one for third. You cannot vote for your own — we checked.',
    },
    {
      eyebrow: 'Step 4',
      heading: 'Points carry to the podium',
      body: 'Five rounds, the role rotates each time, and the totals decide the champion.',
    },
  ],
  react: [
    {
      eyebrow: 'Step 1',
      heading: 'Someone writes the prompt',
      body: 'Each round one player is the Prompter. They write a single line and then sit the round out — no image from them.',
    },
    {
      eyebrow: 'Step 2',
      heading: 'Everyone else answers with a GIF',
      body: 'Search Giphy for the answer that lands. Entries are anonymous until the reveal, and you can swap yours until the clock runs out.',
    },
    {
      eyebrow: 'Step 3',
      heading: 'The room ranks the top three',
      body: 'Three points for first, two for second, one for third. You cannot vote for your own — we checked.',
    },
    {
      eyebrow: 'Step 4',
      heading: 'Points carry to the podium',
      body: 'Five rounds, the role rotates each time, and the totals decide the champion.',
    },
  ],
}
