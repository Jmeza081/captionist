# 0040 — A ballot is secret at every phase

**Status:** accepted · 2026-09-20

## Context

`project()` existed to enforce one rule: an entry is anonymous until the
reveal. It does that correctly, and its docblock states the threat model
plainly — host authority means every client holds the whole room, so "not
rendering it" hides nothing from anyone with devtools.

That rule is about **authorship**: *what* was voted on. Nobody ever wrote a
rule about **ballots**: *who voted for it*. So the redaction was scoped to
`entry.authorId`, gated on `phase === 'vote' || phase === 'tiebreak'`, and
`Round.ballots` — keyed by voter, valued by the entries they ranked — went out
whole, at every phase, to every client.

**Each half is harmless and the join is not.** During the vote, a ballot names
entries whose authors have just been stripped, so it identifies nobody. At the
reveal, authorship deliberately comes back — that is the screen's entire
purpose. But `Round` is not replaced until `round/advanced` calls
`beginRound()`, so the ballots are still there, beside the authorship, for the
whole of the reveal *and* the whole of the untimed scoreboard after it. One
line of devtools turns two innocuous maps into "Jesse put Melania first and
Jack last".

`Tiebreak.votes` is the same map on a worse screen. The duel names both
contenders by design — a head-to-head cannot be anonymous — so its votes need
no join at all to read as "Jesse picked Jack over Lukasz", about two named
colleagues, while the room watches.

No shipped copy promises voter anonymity; the player-facing strings are all
about entries (*"Yours is anonymous until the reveal"*) and all honest. But a
comment in `VoteScreen` explaining why a card's foot omits the author says
*"precisely so that a vote is anonymous"* — conflating the entry being
anonymous with the vote being anonymous. The code delivered the first and the
comment claimed the second.

## Decision

**Authorship and ballots ride different schedules, and `project()` now models
both.** Authorship is secret until the reveal. A ballot is secret always.

- `Round.ballots` is projected to the viewer's own, at **every** phase. Nothing
  outside the host reads another player's: `hasVoted` and `ballotFrom` index
  `ballots[viewerId]`, and the scoring fold and vote gate run host-side on the
  authoritative state, which projection never touches. No screen counts these
  keys, so the record goes rather than its values.
- `Tiebreak.votes` keeps its **keys** and loses its **values**. `tiebreakCopy`
  renders "4 of 7 have voted" off the keys, which is honest and worth keeping.
  An empty entry id in this map means *this seat has voted, and you may not see
  for whom*.
- The redaction is uniform. The host's own projected view is redacted too,
  rather than carrying an exception that would make "can the host see it" a
  second question.

## Consequences

- **A live per-contender tally cannot be derived on a client.** Anything of the
  form "3 for Jack, 2 for Lukasz" must be computed on the host and published as
  a number, because `Object.values(votes)` is now blanks and would read as zero
  votes — quietly wrong rather than loudly broken. This is the sharpest edge
  the decision leaves; the tests in `project.test.ts` name it.
- `project()` no longer returns `state` by identity outside `vote`/`tiebreak`.
  It allocates a round per recipient per broadcast, which is what it already
  did during voting. The selector cache in `useRoomSelector` keys on *snapshot*
  identity, and a snapshot is made per broadcast either way, so nothing
  re-renders that did not before.
- **This is the third route to the same secret**, and the second one that was
  found by looking rather than by a bug report. `redactTiebreak` exists because
  stripping `entry.authorId` left `pending.authorOf` behind; this exists
  because both of those left `ballots` behind. The lesson is recorded here
  rather than learned again: when a field is redacted, the question is not
  "does this screen show it" but "what else in `Round` says the same thing".
- Nothing about the wire format changed — no field was added and no type
  widened, so there is no version skew between a client on the old build and a
  host on the new one. A stale client simply receives less.
- Prediction scoring ([backlog §2.5](../backlog.md)) inherits the rule rather
  than negotiating it: predictions are a ballot by another name and belong in
  the same projection, on the same schedule.
