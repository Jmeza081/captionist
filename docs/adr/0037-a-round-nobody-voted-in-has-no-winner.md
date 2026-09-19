# 0037 — A round nobody voted in has no winner, and a level duel is a coin flip

**Status:** accepted · 2026-09-14

## Context

`tally` seeds every entry at zero and sends everything level at the top to the
tiebreak. When the vote clock ran out on an empty ballot box, "the top" was
zero and *every* entry was level with it — so a room that did not vote got a
five-way "duel" on a screen written for two, and `resolveTiebreak` settled it
the way it settles any persisting tie: a seeded coin flip, which then paid
`TIEBREAK_BONUS` to whichever entry the seed picked. A round nobody scored
handed out a point.

The tiebreak's own copy compounded it. It promised that the Captionist or
Prompter "gets the deciding vote if it's still level", and nothing in the
reducer had ever read `roleHolderId` there. A unit test asserted the role's
name was present in the sentence, which locked the false promise in.

The same flip also hid a harness defect: `room.test.ts` fired the phase clock
before the bots' ballots had resolved, so *every* vote in that spine expired
empty — and every round still "had a winner", which is what the test checked.

## Decision

**Zero ballots is no winner.** When the best entry has no points, `tally`
commits the round with an empty `winnerEntryId` and an empty `ranking`, and
awards nothing. The reveal says "Nobody voted. Nobody wins." and draws no card.

**A persisting tie stays a coin flip, and says so.** The role holder sits the
round out — that is a standing rule, and giving their tiebreak vote extra
weight would be a rule change dressed as a copy fix. The seed keeps deciding,
and the sentence now reads "Still level after that, and we flip a coin."

**The duel's winner leads the ranking.** `resolveTiebreak` used to carry the
pre-duel `ranking` through untouched, whose head was whichever tied entry was
submitted first — so the reveal could tell the duel's loser they came first.
It now hoists the winner to the front.

## Consequences

- An empty `winnerEntryId` is a legal `RoundResult`. `revealWinner` returns
  nothing, `runnersUp` is empty, `myRoundPlacement` is undefined, and no export
  job is built for that round. Anything new that reads `history` has to expect
  it.
- The tiebreak's exclusion line now says a contender "can't vote for their own
  entry", not "in their own duel" — the rule bars backing yourself, and the
  other card is theirs to vote on.
- `?votes=N` is a fixture lever: how many ballots land before the clock runs
  out. `votes=0` is the reveal above.
- The room harness now lets promise chains settle before it fires a phase
  clock, so its rounds are scored by ballots rather than by the flip.
