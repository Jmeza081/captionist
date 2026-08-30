import type { GameAction } from './actions'
import {
  FALLBACK_PROMPTS,
  colorFor,
  MIN_PLAYERS,
  RANK_POINTS,
  SEAT_GRACE_MS,
  TIEBREAK_BONUS,
  durationFor,
} from './constants'
import { pick, shuffle } from './rng'
import { asHatId } from '@/lib/hats'
import { SAMPLE_GIFS, sampleAt } from '@/lib/gifs/samples'
import { toMediaRef } from '@/lib/gifs/types'
import type {
  Clock,
  Entry,
  EntryId,
  GameState,
  Player,
  PlayerId,
  RoomPhase,
  Round,
  RoundResult,
  RoundSubject,
} from './types'

/**
 * The room's state machine.
 *
 * Total and pure: no `Date.now()`, no `Math.random()`, no I/O. Every action
 * carries the timestamp it was applied at, and randomness is drawn from
 * `state.seed`. An illegal or unrecognised action returns the *identical*
 * state reference, which is what lets the store skip a broadcast and lets
 * `useSyncExternalStore` skip a render.
 *
 * Legality is `authorize.ts`'s job. This function assumes it already passed.
 */
export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'room/created':
      return state

    case 'room/settingsChanged':
      return bump({ ...state, settings: { ...state.settings, ...action.patch } })

    case 'player/joined': {
      const player: Player = {
        id: action.player.id,
        name: action.player.name,
        // Assigned here, not by the caller: a seat's colour has to be stable
        // and unique-ish across a room, which only the room can decide.
        color: colorFor(state.players.length),
        avatarSeed: action.player.avatarSeed,
        // **The trust boundary.** A hat arrives from another player's browser
        // and becomes a URL, where a seed only ever feeds DiceBear — so it is
        // narrowed here and `GameState` can hold nothing but the sixteen.
        // `asHatId` rejects `'crown'` too: it is the room's to award, not
        // anybody's to claim.
        hat: asHatId(action.player.hat),
        isHost: state.players.length === 0,
        connection: 'online',
        joinedAt: action.at,
      }
      return bump({ ...state, players: [...state.players, player] })
    }

    case 'player/left':
      // The seat is held, not removed: a drop mid-round must not destroy a
      // submission or renumber everyone's role rotation.
      return bump({
        ...state,
        players: mapPlayer(state.players, action.actor, (p) => ({
          ...p,
          connection: 'reconnecting',
          seatHeldUntil: action.at + SEAT_GRACE_MS,
        })),
      })

    case 'player/reconnected':
      return bump({
        ...state,
        players: mapPlayer(state.players, action.actor, (p) => ({
          ...p,
          connection: 'online',
          seatHeldUntil: undefined,
        })),
      })

    case 'host/left':
      return bump({ ...state, phase: 'podium', clock: { status: 'idle' } })

    case 'game/started': {
      if (state.players.length < MIN_PLAYERS) return state
      return bump(beginRound({ ...state, roundNumber: 1, roleHolderIndex: 0 }, action.at))
    }

    case 'round/subjectLocked': {
      if (!state.round || state.phase !== 'brief') return state
      const round = { ...state.round, subject: action.subject }
      return bump(enterPhase({ ...state, round }, 'compose', action.at))
    }

    case 'round/entrySubmitted': {
      const round = state.round
      if (!round) return state
      const existing = round.entries.find((e) => e.authorId === action.actor)
      const entry: Entry = {
        id: existing?.id ?? `r${round.number}-e${round.entries.length + 1}`,
        authorId: action.actor,
        answer: action.answer,
        submittedAt: action.at,
      }
      const entries = existing
        ? round.entries.map((e) => (e.id === existing.id ? entry : e))
        : [...round.entries, entry]
      const next = { ...state, round: { ...round, entries } }
      // Everyone who is competing has submitted — don't make the room wait out
      // a clock nobody needs.
      if (state.phase === 'compose' && entries.length >= competitorCount(state)) {
        return bump(enterPhase(next, 'waiting', action.at))
      }
      return bump(next)
    }

    case 'round/ballotCast': {
      const round = state.round
      if (!round) return state
      const ballots = { ...round.ballots, [action.actor]: action.ballot }
      const next = { ...state, round: { ...round, ballots } }
      if (Object.keys(ballots).length >= voterCount(state)) {
        return bump(tally(next, action.at))
      }
      return bump(next)
    }

    case 'round/tiebreakVoted': {
      const round = state.round
      const tiebreak = round?.tiebreak
      if (!round || !tiebreak) return state
      const votes = { ...tiebreak.votes, [action.actor]: action.choice }
      const next = { ...state, round: { ...round, tiebreak: { ...tiebreak, votes } } }
      if (Object.keys(votes).length >= voterCount(state)) {
        return bump(resolveTiebreak(next, action.at))
      }
      return bump(next)
    }

    case 'round/advanced': {
      if (state.phase === 'reveal') return bump(enterPhase(state, 'score', action.at))
      if (state.phase !== 'score') return state
      if (state.roundNumber >= state.settings.totalRounds) {
        return bump(enterPhase({ ...state, round: null }, 'podium', action.at))
      }
      return bump(
        beginRound(
          {
            ...state,
            roundNumber: state.roundNumber + 1,
            roleHolderIndex: state.roleHolderIndex + 1,
          },
          action.at,
        ),
      )
    }

    case 'host/paused': {
      if (state.clock.status !== 'running') return state
      return bump({
        ...state,
        clock: {
          status: 'paused',
          remainingMs: Math.max(0, state.clock.endsAt - action.at),
          totalMs: state.clock.totalMs,
        },
      })
    }

    case 'host/resumed': {
      if (state.clock.status !== 'paused') return state
      return bump({
        ...state,
        clock: {
          status: 'running',
          endsAt: action.at + state.clock.remainingMs,
          totalMs: state.clock.totalMs,
        },
      })
    }

    case 'host/adjustedClock': {
      const clock = state.clock
      if (clock.status === 'running') {
        // Floored at `at`, so dragging the stepper to zero means "expire now"
        // rather than leaving a running clock with a deadline in the past.
        const endsAt = Math.max(action.at, clock.endsAt + action.deltaMs)
        return bump({ ...state, clock: { ...clock, endsAt } })
      }
      if (clock.status === 'paused') {
        const remainingMs = Math.max(0, clock.remainingMs + action.deltaMs)
        return bump({ ...state, clock: { ...clock, remainingMs } })
      }
      return state
    }

    case 'host/skippedPhase':
      return bump(advance(state, action.at))

    case 'host/switchedMode':
      return bump({ ...state, settings: { ...state.settings, mode: action.mode } })

    case 'host/forcedTie': {
      const round = state.round
      if (!round || round.entries.length < 2) return state
      const contenders = round.entries.slice(0, 2).map((e) => e.id)
      const pending = scoreRound(state, Object.fromEntries(contenders.map((id) => [id, 0])))
      return bump(
        enterPhase(
          { ...state, round: { ...round, tiebreak: { contenders, votes: {}, pending } } },
          'tiebreak',
          action.at,
        ),
      )
    }

    case 'host/jumpedToPodium':
      return bump(enterPhase({ ...state, round: null }, 'podium', action.at))

    case 'host/restarted':
      return bump({
        ...state,
        phase: 'lobby',
        clock: { status: 'idle' },
        roundNumber: 0,
        roleHolderIndex: 0,
        round: null,
        history: [],
      })

    case 'clock/expired': {
      // The guard that makes a late, duplicate or stale timer harmless.
      if (action.phase !== state.phase) return state
      return bump(advance(state, action.at))
    }

    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/* Phase machinery                                                     */
/* ------------------------------------------------------------------ */

/** What a phase's clock expiring, or the host skipping it, does. */
function advance(state: GameState, at: number): GameState {
  switch (state.phase) {
    case 'opener':
      return enterPhase(state, 'brief', at)

    case 'brief': {
      // A round must not stall on an absent role holder.
      if (state.round && !state.round.subject) {
        const [subject, seed] = fallbackSubject(state)
        return enterPhase({ ...state, seed, round: { ...state.round, subject } }, 'compose', at)
      }
      return enterPhase(state, 'compose', at)
    }

    case 'compose':
      return enterPhase(state, 'waiting', at)

    case 'waiting':
      return openVoting(state, at)

    case 'vote':
      return tally(state, at)

    case 'tiebreak':
      return resolveTiebreak(state, at)

    case 'reveal':
      return enterPhase(state, 'score', at)

    default:
      return state
  }
}

function enterPhase(state: GameState, phase: RoomPhase, at: number): GameState {
  const totalMs = durationFor(phase, state.settings)
  const clock: Clock =
    totalMs === null ? { status: 'idle' } : { status: 'running', endsAt: at + totalMs, totalMs }
  return { ...state, phase, clock }
}

function beginRound(state: GameState, at: number): GameState {
  const roleHolder = state.players[state.roleHolderIndex % state.players.length]
  if (!roleHolder) return state
  const round: Round = {
    number: state.roundNumber,
    roleHolderId: roleHolder.id,
    subject: null,
    entries: [],
    ballots: {},
    order: [],
    tiebreak: null,
  }
  return enterPhase({ ...state, round }, 'opener', at)
}

/** Opens voting, shuffling the grid from the seed so the order is reproducible. */
function openVoting(state: GameState, at: number): GameState {
  const round = state.round
  if (!round) return state
  const [order, seed] = shuffle(
    round.entries.map((e) => e.id),
    state.seed,
  )
  return enterPhase({ ...state, seed, round: { ...round, order } }, 'vote', at)
}

function fallbackSubject(state: GameState): [RoundSubject, number] {
  if (state.settings.mode === 'react') {
    const [text, seed] = pick(FALLBACK_PROMPTS, state.seed)
    return [{ kind: 'prompt', text: text ?? FALLBACK_PROMPTS[0] ?? '' }, seed]
  }
  /**
   * Caption mode picks *something*, always.
   *
   * This used to hand back an empty `src` with honest alt text, which meant a
   * role holder who ran out of time left the whole room captioning a dashed
   * grey box — everyone else's round spoiled by one person's hesitation. The
   * offline shelf is committed art with no key and no network behind it, so
   * the reducer can reach it and stay pure.
   *
   * The room's own seed chooses, so every client lands on the same image from
   * the same state — a `Math.random` here would give the host one GIF and each
   * guest another. The brief screen locks a real Giphy result in a beat before
   * this fires (see `BriefScreen`); this is the net for a role holder whose tab
   * is gone.
   */
  const [gif, seed] = pick(SAMPLE_GIFS, state.seed)
  const chosen = gif ?? sampleAt(0)
  return [{ kind: 'media', media: toMediaRef(chosen) }, seed]
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** Ranking points per entry, summed across every ballot cast. */
function pointsByEntry(state: GameState): Record<EntryId, number> {
  const round = state.round
  const points: Record<EntryId, number> = {}
  if (!round) return points
  for (const entry of round.entries) points[entry.id] = 0
  for (const ballot of Object.values(round.ballots)) {
    if (ballot.kind === 'rank') {
      ballot.ranked.forEach((id, i) => {
        const award = RANK_POINTS[i] ?? 0
        if (id in points) points[id] = (points[id] ?? 0) + award
      })
    } else if (ballot.choice in points) {
      points[ballot.choice] = (points[ballot.choice] ?? 0) + 1
    }
  }
  return points
}

/** Builds the round's result from a points-by-entry map. */
function scoreRound(state: GameState, points: Record<EntryId, number>): RoundResult {
  const round = state.round
  const entries = round?.entries ?? []
  const authorOf: Record<EntryId, PlayerId> = {}
  const byPlayer: Record<PlayerId, number> = {}
  for (const entry of entries) {
    if (!entry.authorId) continue
    authorOf[entry.id] = entry.authorId
    byPlayer[entry.authorId] = points[entry.id] ?? 0
  }
  const ranking = entries
    .map((e) => e.id)
    .sort((a, b) => (points[b] ?? 0) - (points[a] ?? 0))
  return {
    round: round?.number ?? state.roundNumber,
    winnerEntryId: ranking[0] ?? '',
    points: byPlayer,
    ranking,
    authorOf,
  }
}

function tally(state: GameState, at: number): GameState {
  const round = state.round
  if (!round) return state
  const points = pointsByEntry(state)
  const result = scoreRound(state, points)
  const best = Math.max(...Object.values(points), 0)
  const tied = round.entries.map((e) => e.id).filter((id) => (points[id] ?? 0) === best)

  if (tied.length > 1) {
    return enterPhase(
      { ...state, round: { ...round, tiebreak: { contenders: tied, votes: {}, pending: result } } },
      'tiebreak',
      at,
    )
  }
  return commit(state, result, at)
}

function resolveTiebreak(state: GameState, at: number): GameState {
  const round = state.round
  const tiebreak = round?.tiebreak
  if (!round || !tiebreak) return state

  const counts: Record<EntryId, number> = {}
  for (const id of tiebreak.contenders) counts[id] = 0
  for (const choice of Object.values(tiebreak.votes)) {
    if (choice in counts) counts[choice] = (counts[choice] ?? 0) + 1
  }
  const best = Math.max(...Object.values(counts), 0)
  const stillTied = tiebreak.contenders.filter((id) => (counts[id] ?? 0) === best)

  // Still level after the deciding vote: the seed breaks it rather than
  // looping the room through another fifteen seconds.
  let winner = stillTied[0] ?? tiebreak.contenders[0] ?? ''
  let seed = state.seed
  if (stillTied.length > 1) {
    const [chosen, advanced] = pick(stillTied, state.seed)
    winner = chosen ?? winner
    seed = advanced
  }

  const winnerAuthor = tiebreak.pending.authorOf[winner]
  const points = { ...tiebreak.pending.points }
  if (winnerAuthor) points[winnerAuthor] = (points[winnerAuthor] ?? 0) + TIEBREAK_BONUS

  const result: RoundResult = { ...tiebreak.pending, winnerEntryId: winner, points }
  return commit({ ...state, seed }, result, at)
}

function commit(state: GameState, result: RoundResult, at: number): GameState {
  const round = state.round
  return enterPhase(
    {
      ...state,
      history: [...state.history, result],
      round: round ? { ...round, tiebreak: null } : null,
    },
    'reveal',
    at,
  )
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Everyone except the role holder, who sets the round up and sits it out. */
function competitorCount(state: GameState): number {
  return Math.max(0, state.players.length - 1)
}

/** Everyone votes, the role holder included — they judge, they don't compete. */
function voterCount(state: GameState): number {
  return state.players.length
}

function mapPlayer(
  players: readonly Player[],
  id: PlayerId,
  fn: (p: Player) => Player,
): readonly Player[] {
  return players.map((p) => (p.id === id ? fn(p) : p))
}

/** Every accepted change advances `rev`; the transport orders on it. */
function bump(state: GameState): GameState {
  return { ...state, rev: state.rev + 1 }
}
