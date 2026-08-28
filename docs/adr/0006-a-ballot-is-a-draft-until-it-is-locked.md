# 0006 — A ballot is a draft until it is locked

**Status:** accepted · 2026-08-27

## Context

`VoteScreen` lets you rank three entries, one tap at a time. The obvious
implementation dispatches `round/ballotCast` on each tap: the reducer already
upserts a ballot by author, the action is idempotent, and the state would then
be the single source of truth for what is ranked — no local state, no
divergence, `voteCards().rank` reads straight back out.

It would also end the round.

`reducer.ts` tallies the moment the last ballot lands:

```ts
if (Object.keys(ballots).length >= voterCount(state)) {
  return bump(tally(next, action.at))
}
```

That check counts *voters who have cast anything*, not voters who have finished.
A partial ballot is still a ballot. So in a room where four people have locked
in and one has not, the fifth person's **first tap** would tally the round —
scoring their single pick as a complete ranking and jumping everyone to the
reveal while they were still choosing. The bug does not appear in a one-player
harness, and it appears rarely and unreproducibly in a real room, because it
needs everyone else to have finished first.

Two other fixes were considered:

- **Count only complete ballots in the reducer.** It moves "how many places is a
  complete ballot" into the reducer, which would then need `RANK_POINTS`, the
  entry count and the own-entry exclusion — that is `lockGate`'s job, and the
  reducer would be re-deriving a view concern to answer a domain question.
- **A separate `round/ballotDrafted` action.** A second action, a second guard,
  a second thing to project and order, and every one of them broadcast to
  twenty clients on every tap — to carry state that nobody outside the tapping
  browser is allowed to see anyway.

## Decision

**The ranking is local component state until the player locks it in.**
`VoteScreen` holds `(EntryId | null)[]`, and exactly one `round/ballotCast` is
dispatched, from the button.

The gate is answerable from either: `lockGateFrom(state, viewerId, ranked)`
takes the count as an argument, and `lockGate` — which reads the committed
ballot — delegates to it. One function, so the label a drafting player sees and
the label a returning one sees cannot drift.

Once a ballot *is* committed, it wins: the screen reads its places back from
`voteCards().rank` rather than from the draft, so a re-render after locking
shows what the room holds rather than what was being typed.

## Consequences

- **A refresh mid-vote loses an unlocked ranking.** Accepted. The alternative is
  broadcasting picks that are supposed to be secret, and a 60-second phase is
  not long enough for the loss to be worth a persistence mechanism.
- **`useRoomSelector` still has no caller.** It was built for this screen —
  twenty live cards re-rendering on every broadcast — and the draft made it
  unnecessary, because the tap-by-tap re-render is now local and the broadcasts
  during `vote` are other people's ballots landing, which every card wants
  anyway. It stays for the first list that genuinely needs it.
- **The reducer's early-tally rule is untouched**, so it keeps doing the thing it
  is actually for: ending the phase the instant the last real ballot arrives,
  rather than making a finished room wait out the clock.
- **The same shape applies to any future multi-step submission.** Draft locally,
  commit once. `round/entrySubmitted` already works this way for the same
  reason — `ComposeScreen` holds the caption fields, not the room.
