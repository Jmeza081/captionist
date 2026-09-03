import { HOST_ONLY, PHASE_GUARDS, type GameAction } from './actions'
import { MIN_PLAYERS } from './constants'
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
      // **Only the host seats bots.** `player/joined` is deliberately absent
      // from `HOST_ONLY` and from `PHASE_GUARDS` — joining is legal in any
      // phase, from any client, which is what lets a late arrival hop in
      // between rounds. That openness is exactly why this check has to exist:
      // without it any browser could seat twenty bots in someone else's room
      // and spend a budget it does not pay for.
      if (action.player.bot !== undefined && action.actor !== state.hostId) {
        return 'Only the host can add a bot.'
      }
      // The room's own size, which the host chose, not the global ceiling.
      if (state.players.length >= state.settings.maxPlayers) {
        return `This room is full — ${state.settings.maxPlayers} players is the limit.`
      }
      if (
        state.settings.uniqueNicknames &&
        state.players.some((p) => p.name.toLowerCase() === action.player.name.toLowerCase())
      ) {
        return 'Someone already has that name. Pick another.'
      }
      return true
    }

    case 'host/botRemoved': {
      const target = state.players.find((p) => p.id === action.id)
      if (!target) return 'That player has already left.'
      // A host who could remove *people* is a different feature with a
      // different conversation attached to it. This one only fires bots.
      if (!target.bot) return 'You can only remove a bot.'
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
      // The room's voting rule, enforced where every client meets it rather
      // than in the screen that happens to draw the slots. A three-deep rank
      // ballot in a single-vote room paid 3/2/1 against a setting that
      // promised one point. A one-deep rank ballot stays legal — that is what
      // a room with two entries casts, and what the tiebreak fixture builds.
      if (state.settings.voting === 'single' && ids.length > 1)
        return 'This room takes one vote each, not a ranking.'
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
