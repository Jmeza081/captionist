import { HOST_ONLY, PHASE_GUARDS, type GameAction } from './actions'
import { MAX_PLAYERS, MIN_PLAYERS } from './constants'
import type { GameState } from './types'

/**
 * Is this action allowed right now?
 *
 * Deliberately outside the reducer. Keeping it separate means the host-only
 * set and the phase guards read as tables instead of fourteen early returns
 * buried in a switch, and the failure is a *sentence* — copy the snackbar can
 * show directly, per the design's rule that an error says what happened and
 * what to do next.
 *
 * `reduce` assumes legality. The host engine calls this first.
 */
export function authorize(state: GameState, action: GameAction): true | string {
  const actor = state.players.find((p) => p.id === action.actor)

  if (action.type === 'room/created') return true

  if (!actor && action.type !== 'player/joined') {
    return 'You are not in this room. Rejoin with the room code.'
  }

  if (HOST_ONLY.has(action.type) && action.actor !== state.hostId) {
    return 'Only the host can do that.'
  }

  const allowedPhases = PHASE_GUARDS[action.type]
  if (allowedPhases && !allowedPhases.includes(state.phase)) {
    return `That is not available during ${state.phase}.`
  }

  switch (action.type) {
    case 'player/joined': {
      if (state.players.length >= MAX_PLAYERS) {
        return `This room is full — ${MAX_PLAYERS} players is the limit.`
      }
      if (
        state.settings.uniqueNicknames &&
        state.players.some((p) => p.name.toLowerCase() === action.player.name.toLowerCase())
      ) {
        return 'Someone already has that name. Pick another.'
      }
      return true
    }

    case 'game/started': {
      const short = MIN_PLAYERS - state.players.length
      if (short > 0) return `Need ${short} more ${short === 1 ? 'player' : 'players'}.`
      return true
    }

    case 'round/subjectLocked': {
      if (state.round?.roleHolderId !== action.actor) {
        return 'Only this round’s role holder sets it up.'
      }
      return true
    }

    case 'round/entrySubmitted': {
      // The role holder sets the round up and sits it out. This is the rule
      // the design never states, and it is load-bearing in five places.
      if (state.round?.roleHolderId === action.actor) {
        return 'You set this round up, so you sit it out.'
      }
      return true
    }

    case 'round/ballotCast': {
      const own = state.round?.entries.find((e) => e.authorId === action.actor)
      const ids =
        action.ballot.kind === 'rank' ? action.ballot.ranked : [action.ballot.choice]
      if (own && ids.includes(own.id)) return 'You cannot vote for your own — we checked.'
      if (new Set(ids).size !== ids.length) return 'Pick a different entry for each place.'
      const known = new Set(state.round?.entries.map((e) => e.id) ?? [])
      if (ids.some((id) => !known.has(id))) return 'That entry is not in this round.'
      return true
    }

    case 'round/tiebreakVoted': {
      const contenders = state.round?.tiebreak?.contenders ?? []
      if (!contenders.includes(action.choice)) return 'That entry is not in the tiebreak.'
      const own = state.round?.entries.find((e) => e.authorId === action.actor)
      if (own && own.id === action.choice) return 'You cannot vote for your own — we checked.'
      return true
    }

    default:
      return true
  }
}
