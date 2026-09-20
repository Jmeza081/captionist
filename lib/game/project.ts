import type { EntryId, GameState, PlayerId, PublicState, Round } from './types'

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
 *
 * **Two axes, not one.** Authorship is *what* was voted on, and it is public
 * from the reveal onward by design. A ballot is *who voted for it*, and that
 * is never public — so the two have different schedules and the redaction
 * below runs at every phase rather than only while the vote is open. See
 * [ADR 0040](../../docs/adr/0040-a-ballot-is-secret-at-every-phase.md).
 */
export function project(state: GameState, viewerId: PlayerId): PublicState {
  if (!state.round) return state

  // Entry authorship, and only it, is what the reveal hands back.
  const hidden = state.phase === 'vote' || state.phase === 'tiebreak'

  const round: Round = {
    ...state.round,
    entries: hidden
      ? state.round.entries.map((entry) =>
          entry.authorId === viewerId ? entry : { ...entry, authorId: undefined },
        )
      : state.round.entries,
    ballots: ownBallotOnly(state.round.ballots, viewerId),
    tiebreak: redactTiebreak(state.round.tiebreak, viewerId, hidden),
  }

  return { ...state, round }
}

/**
 * A ballot is the viewer's own or it is not on the wire.
 *
 * `Round.ballots` is keyed by *voter* and valued by the entries they ranked.
 * On its own that names nobody — during the vote, `entry.authorId` is stripped,
 * so another player's ballot is a list of ids belonging to people you cannot
 * identify. The leak is the **join**: at the reveal authorship comes back, and
 * `ballots` is still sitting beside it, unchanged, because `Round` is not
 * replaced until `round/advanced` calls `beginRound()`. So for the whole of the
 * reveal *and* the whole of the untimed scoreboard after it, one line of
 * devtools turns "p4 ranked r3-e2 first" into "Jesse put Melania first and
 * Jack last".
 *
 * Nothing outside the host needs another player's ballot. `hasVoted` and
 * `ballotFrom` index `ballots[viewerId]`; the scoring fold and the vote gate
 * (`reducer.ts`) run host-side on the authoritative state, which projection
 * never touches. Unlike the tiebreak below, no screen counts these keys, so
 * the whole record goes rather than just its values.
 */
function ownBallotOnly(ballots: Round['ballots'], viewerId: PlayerId): Round['ballots'] {
  const own = ballots[viewerId]
  return own === undefined ? {} : { [viewerId]: own }
}

/**
 * The tiebreak carries a `pending` result, and a `RoundResult` carries
 * `authorOf` — a complete entry-to-author map for the *whole* round. Stripping
 * `entry.authorId` while leaving that in place would hand every client the
 * authorship it just redacted, by a second route.
 *
 * The duel itself is the one named screen before the reveal: a head-to-head
 * cannot be anonymous, and the design puts both faces under the cards. So the
 * map is narrowed to the contenders rather than removed.
 *
 * **`votes` is the third route, and the worst of them.** It is the same
 * voter-to-choice map as `ballots`, on a screen that has *already* named both
 * contenders — so it needs no join at all. Left whole it reads directly as
 * "Jesse picked Jack over Lukasz", during a duel between two colleagues the
 * room is watching.
 *
 * It cannot be dropped the way `ballots` is: `tiebreakCopy` counts these keys
 * for "4 of 7 have voted", which is honest and worth keeping. So the keys stay
 * and the choices go — **an empty id here means "this seat has voted, and you
 * may not see for whom"**. Nothing reads another player's choice client-side;
 * the tally in `reducer.ts` is host-side. A future per-contender live tally
 * would have to be computed on the host and published, not derived here — it
 * would read these blanks as zero votes and be quietly wrong.
 */
function redactTiebreak(
  tiebreak: Round['tiebreak'],
  viewerId: PlayerId,
  hidden: boolean,
): Round['tiebreak'] {
  if (!tiebreak) return tiebreak

  const votes: Record<PlayerId, EntryId> = {}
  for (const voter of Object.keys(tiebreak.votes)) {
    const choice = tiebreak.votes[voter]
    votes[voter] = voter === viewerId && choice !== undefined ? choice : ''
  }

  // Authorship rides the same schedule as `entry.authorId` — public from the
  // reveal — so this half stays gated where it was.
  if (!hidden) return { ...tiebreak, votes }

  const authorOf: Record<EntryId, PlayerId> = {}
  for (const id of tiebreak.contenders) {
    const author = tiebreak.pending.authorOf[id]
    if (author) authorOf[id] = author
  }
  return { ...tiebreak, votes, pending: { ...tiebreak.pending, authorOf } }
}
