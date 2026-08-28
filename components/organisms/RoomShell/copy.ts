import { isRoleHolder, roleHolder } from '@/lib/game/selectors'
import type { GameState, PlayerId } from '@/lib/game/types'

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
