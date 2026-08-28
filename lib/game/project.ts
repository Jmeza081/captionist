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
 */
export function project(state: GameState, viewerId: PlayerId): PublicState {
  const hidden = state.phase === 'vote' || state.phase === 'tiebreak'
  if (!hidden || !state.round) return state

  const round: Round = {
    ...state.round,
    entries: state.round.entries.map((entry) =>
      entry.authorId === viewerId ? entry : { ...entry, authorId: undefined },
    ),
    tiebreak: redactTiebreak(state.round.tiebreak),
  }

  return { ...state, round }
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
 */
function redactTiebreak(tiebreak: Round['tiebreak']): Round['tiebreak'] {
  if (!tiebreak) return tiebreak
  const authorOf: Record<EntryId, PlayerId> = {}
  for (const id of tiebreak.contenders) {
    const author = tiebreak.pending.authorOf[id]
    if (author) authorOf[id] = author
  }
  return { ...tiebreak, pending: { ...tiebreak.pending, authorOf } }
}
