import type { GameState, PlayerId, PublicState } from './types'

/**
 * What actually goes on the wire.
 *
 * Host authority means every client holds the whole room state, so "anonymous
 * until the reveal" cannot be enforced by simply not rendering the author —
 * anyone with devtools open would see it. Authorship is stripped from the
 * broadcast entirely while voting is open, and comes back at the reveal.
 *
 * The viewer keeps their *own* authorship, because the vote grid has to dim
 * and lock their own entry.
 */
export function project(state: GameState, viewerId: PlayerId): PublicState {
  const hidden = state.phase === 'vote' || state.phase === 'tiebreak'
  if (!hidden || !state.round) return state

  return {
    ...state,
    round: {
      ...state.round,
      entries: state.round.entries.map((entry) =>
        entry.authorId === viewerId ? entry : { ...entry, authorId: undefined },
      ),
    },
  }
}
