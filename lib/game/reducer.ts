import type { GameAction } from './actions'
import {
  FALLBACK_PROMPTS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RANK_POINTS,
  ROUNDS_MAX,
  ROUNDS_MIN,
  SEAT_GRACE_MS,
  TIEBREAK_BONUS,
  WAITING_ALL_IN_MS,
  colorFor,
  durationFor,
} from './constants'
import { pick, shuffle } from './rng'
import { asBotDifficulty } from '@/lib/bots/types'
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

    /**
     * Both numeric settings are clamped to their own bounds on the way in.
     *
     * They used to constrain *each other* — lowering the room size stranded
     * `totalRounds` above what the GIF allowance afforded that size — and that
     * coupling is gone with the allowance (ADR-0026). What survives is the
     * reason it was done here rather than in `/host`: every road in — the setup
     * screen, a URL lever, a fixture — should land on a legal room, and only
     * one of those roads passes a stepper that already knows the bounds.
     */
    case 'room/settingsChanged': {
      const settings = { ...state.settings, ...action.patch }
      return bump({
        ...state,
        settings: {
          ...settings,
          maxPlayers: clamp(settings.maxPlayers, MIN_PLAYERS, MAX_PLAYERS),
          totalRounds: clamp(settings.totalRounds, ROUNDS_MIN, ROUNDS_MAX),
        },
      })
    }

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
        // Narrowed the same way a hat is, and for the same reason: this
        // arrives from a browser and selects a persona. `authorize` has
        // already refused it from anyone but the host.
        ...(asBotDifficulty(action.player.bot) ? { bot: asBotDifficulty(action.player.bot) } : {}),
        isHost: state.players.length === 0,
        connection: 'online',
        joinedAt: action.at,
      }
      return bump({ ...state, players: [...state.players, player] })
    }

    case 'player/left': {
      // The seat is held, not removed: a drop mid-round must not destroy a
      // submission or renumber everyone's role rotation.
      const next = {
        ...state,
        players: mapPlayer(state.players, action.actor, (p) => ({
          ...p,
          connection: 'reconnecting' as const,
          seatHeldUntil: action.at + SEAT_GRACE_MS,
        })),
      }
      // A drop lowers the denominator, and the phase gates only ever fire when
      // the *numerator* rises — so without this the last person the room was
      // waiting on could close their tab and the room would sit out the whole
      // clock waiting for them. See `settleGates`.
      return bump(settleGates(next, action.at))
    }

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

    case 'host/botRemoved': {
      const target = state.players.find((p) => p.id === action.id)
      // Only ever a bot. A host who could remove *people* is a different
      // feature with a different conversation attached to it.
      if (!target?.bot) return state
      // Removed outright, not held. A held seat exists to survive a reconnect,
      // and nothing is coming back — leaving it would keep a phantom in every
      // phase gate for `SEAT_GRACE_MS` and in the roster forever.
      return bump({ ...state, players: state.players.filter((p) => p.id !== action.id) })
    }

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
      return bump(settleGates(next, action.at))
    }

    case 'round/ballotCast': {
      const round = state.round
      if (!round) return state
      const ballots = { ...round.ballots, [action.actor]: action.ballot }
      const next = { ...state, round: { ...round, ballots } }
      return bump(settleGates(next, action.at))
    }

    case 'round/tiebreakVoted': {
      const round = state.round
      const tiebreak = round?.tiebreak
      if (!round || !tiebreak) return state
      const votes = { ...tiebreak.votes, [action.actor]: action.choice }
      const next = { ...state, round: { ...round, tiebreak: { ...tiebreak, votes } } }
      return bump(settleGates(next, action.at))
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

    /**
     * The GIF budget ran out, so that is the game.
     *
     * The same landing as the host jumping to the podium — the round in
     * progress is dropped and scores stand from the rounds that completed —
     * plus a reason, because the podium has something to explain. Idempotent
     * by the phase guard: a second client reporting the same 429 is refused
     * in `podium` rather than re-entering it.
     */
    case 'game/gifsExhausted':
      return bump(
        enterPhase({ ...state, round: null, endedBecause: 'gifs' }, 'podium', action.at),
      )

    case 'host/restarted':
      return bump({
        ...state,
        phase: 'lobby',
        clock: { status: 'idle' },
        roundNumber: 0,
        roleHolderIndex: 0,
        round: null,
        history: [],
        // Cleared, or the next podium would still be apologising for the
        // last game's rate limit.
        endedBecause: undefined,
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
      // The role holder may have dropped during `score`, before this round
      // existed — in which case `brief` is a dead phase from the moment it
      // opens, and no connection change is coming to notice it. Terminates at
      // depth two: `settleGates`' `brief` branch calls `advance('brief')`,
      // which reaches neither this case nor itself.
      return settleGates(enterPhase(state, 'brief', at), at)

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
  const totalMs = phaseLength(state, phase)
  const clock: Clock =
    totalMs === null ? { status: 'idle' } : { status: 'running', endsAt: at + totalMs, totalMs }
  return { ...state, phase, clock }
}

/**
 * How long `phase` runs from here.
 *
 * Every phase but `waiting` takes its length off the table. `waiting` reads the
 * tracker instead, because it is entered two ways and they are not the same
 * wait: the last entry landing leaves nobody to wait for, and the compose clock
 * expiring leaves stragglers. The first gets a beat long enough to read the
 * confirmation on; the second gets the full 12s, and a host who may cut it
 * short.
 */
function phaseLength(state: GameState, phase: RoomPhase): number | null {
  if (phase !== 'waiting') return durationFor(phase, state.settings)
  // Same both-sides rule as `settleGates` — a wait that is over because
  // everybody left should read as over, and a held entry must not make it so.
  const roster = competingPlayers(state)
  const submitted = countPresent(roster, state.round?.entries.map((e) => e.authorId) ?? [])
  return submitted >= roster.length ? WAITING_ALL_IN_MS : durationFor(phase, state.settings)
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
   * guest another. The brief screen locks a real provider result in a beat before
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

/**
 * Everyone except the role holder, who sets the round up and sits it out — and
 * except anyone whose tab is gone.
 *
 * This used to be `players.length - 1`, which counted a closed tab as a player
 * the room was still waiting on: the tracker said "still thinking" about a
 * browser that no longer existed, and every phase ran its full clock out. The
 * seat is still held (`player/left`) and the points still count; what stops is
 * being *waited for*.
 */
function competingPlayers(state: GameState): readonly Player[] {
  return state.players.filter(
    (p) => p.id !== state.round?.roleHolderId && p.connection === 'online',
  )
}

/** Everyone votes, the role holder included — they judge, they don't compete. */
function votingPlayers(state: GameState): readonly Player[] {
  return state.players.filter((p) => p.connection === 'online')
}

/**
 * How many of `roster` are among `ids` — the numerator's half of the same rule.
 *
 * **Both sides of a gate must count the same people, or the gate lies.** A drop
 * holds the seat *and the entry*, so filtering only the denominator opens the
 * gate early in a way that is easy to miss: five players, three of the four
 * competitors have submitted, and one of *those three* closes their tab. The
 * denominator falls to three; `entries.length` is still three, because the held
 * entry is still there. The room would advance to voting with somebody who is
 * present and still typing.
 */
function countPresent(
  roster: readonly Player[],
  ids: Iterable<PlayerId | undefined>,
): number {
  const here = new Set(roster.map((p) => p.id))
  let n = 0
  for (const id of ids) {
    if (id !== undefined && here.has(id)) n += 1
  }
  return n
}

/**
 * Re-ask the question a submission or a ballot asks.
 *
 * The three phase gates below live in the actions that raise the numerator —
 * an entry arriving, a ballot cast. A drop moves the *denominator* instead, and
 * arrives as a different action entirely, so the same three questions have to
 * be asked from there too. One helper rather than three copied `if` blocks.
 *
 * Every branch is guarded on the current phase, so this can only ever move the
 * room forward from where it already is: a reconnect cannot rewind a phase the
 * room has passed, and a second call is a no-op.
 *
 * The zero guards are not defensive noise. With nobody online every gate is
 * trivially true, and an empty room would fall through compose, vote, tiebreak
 * and reveal in a single tick — a room that lost its last guest would race
 * itself to the podium instead of sitting still and waiting for someone to
 * come back.
 */
function settleGates(state: GameState, at: number): GameState {
  const round = state.round
  if (!round) return state

  if (state.phase === 'brief' && !round.subject) {
    // The one gate here that is not a denominator. `authorize` lets nobody but
    // the role holder lock a subject, so a role holder who is gone leaves a
    // phase whose only exit is its clock — and `advance` already knows what to
    // do at the end of it. Going through `advance` rather than picking a
    // subject here keeps `fallbackSubject` the single answer, seed and all.
    const holder = state.players.find((p) => p.id === round.roleHolderId)
    if (holder && holder.connection !== 'online') return advance(state, at)
    return state
  }

  if (state.phase === 'compose') {
    const roster = competingPlayers(state)
    const inHand = countPresent(
      roster,
      round.entries.map((e) => e.authorId),
    )
    if (roster.length > 0 && inHand >= roster.length) return enterPhase(state, 'waiting', at)
    return state
  }

  if (state.phase === 'vote') {
    const roster = votingPlayers(state)
    const inHand = countPresent(roster, Object.keys(round.ballots))
    if (roster.length > 0 && inHand >= roster.length) return tally(state, at)
    return state
  }

  if (state.phase === 'tiebreak' && round.tiebreak) {
    const roster = votingPlayers(state)
    const inHand = countPresent(roster, Object.keys(round.tiebreak.votes))
    if (roster.length > 0 && inHand >= roster.length) return resolveTiebreak(state, at)
  }

  return state
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

/** Keeps a setting inside its own bounds, whichever road it arrived by. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
