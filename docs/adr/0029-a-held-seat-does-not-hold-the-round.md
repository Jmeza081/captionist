# 0029 — A held seat does not hold the round

**Status:** accepted · 2026-09-01

## Context

Phase 5 wired presence to the roster. `HostEngine.reconcile()` turns "who is
attached" into "who is playing": a member vanishing applies `player/left`, which
marks the seat `reconnecting` and holds it for `SEAT_GRACE_MS`. The comment
above it was proud of the fact that `ConnectionState` finally had a reader.

It had one reader. **The round had none.**

```ts
function competitorCount(state: GameState): number {
  return Math.max(0, state.players.length - 1)
}
```

That is what gated `compose → waiting`. `voterCount` was `players.length`.
`competitors()` in the selectors filtered the role holder and nothing else. So a
player who closed their tab kept their place in every denominator: the tracker
said "still thinking" over a browser that no longer existed, the count read "3
of 4" forever, and every phase they were in ran its full clock out with nobody
left to end it. Playtesting reported it as guests becoming "dangling
references" — the room went on asking them for an entry.

Two smaller things travelled with it. `tiebreakCopy`'s vote line counted the
whole roster while the reducer resolved at the present count, so a duel could
say "4 of 7 have voted" and end. And `seatState()`, which derives `'gone'` from
`seatHeldUntil`, had zero production callers.

## Decision

**The moment presence marks a seat dropped, it stops counting. The seat, the
entry and the points are still held.**

### Both sides of a gate count the same people

The obvious fix — filter the denominator — is wrong, and wrong in a way that is
easy to ship. Five players, four competitors, three have submitted, and one of
*those three* closes their tab. The denominator falls to three; `entries.length`
is still three, because the held entry is exactly what the held seat preserves.
The room advances to voting with a present player still typing.

So the numerator is filtered too:

```ts
function countPresent(roster, ids): number
```

Every gate asks `countPresent(roster, …) >= roster.length`, where `roster` is
`competingPlayers` or `votingPlayers`. `phaseLength('waiting')` asks the same
question for `WAITING_ALL_IN_MS`.

### Lowering a denominator has to re-ask the question

The three gates lived inside the actions that *raise the numerator* — an entry
arriving, a ballot cast. A drop moves the other side and arrives as a different
action, so `settleGates(state, at)` holds all three and is called from
`round/entrySubmitted`, `round/ballotCast`, `round/tiebreakVoted` and
`player/left`. Without that, the last outstanding player leaving strands the
room on a full clock — the exact bug, one action further along.

Every branch switches on the phase it is already in and returns either that
phase's successor or the identical state, so **it can only move forward.** A
reconnect raises the denominator, the `>=` fails, and nothing happens; a second
call is a no-op.

Every branch also guards on a non-zero roster. With nobody online each gate is
trivially true, and an empty room would fall through compose, vote, tiebreak and
reveal in one tick — a room that lost its last guest racing itself to the podium
instead of sitting still and waiting for someone to come back.

### The role holder is the one gate that is not a count

Nobody but the role holder may lock a subject (`authorize`), so a Prompter who
drops leaves a phase whose only exit is its clock. `settleGates`' `brief` branch
calls `advance()` — the same road the clock takes — so `fallbackSubject()` stays
the single answer, seed and all, and every client resolves the same subject.

`advance('opener')` calls `settleGates` too, for the case no connection change
is coming: a role holder who dropped during `score` makes `brief` a dead phase
from the moment it opens.

**The role is not reassigned.** Renumbering the rotation mid-round is precisely
what the held seat exists to prevent. The round runs on the fallback and the
role rotates normally next round.

### Reconcile only reports seats presence has actually seen

Absence proves nothing on its own. A `?phase=` fixture room's players are in
`state.players` and were never connections at all, and a real guest is in the
roster for a moment before their presence entry is read. Both were being marked
`reconnecting` — harmless while nothing read the flag, and a room full of
phantoms the moment the gates did. `HostEngine` now tracks the ids presence has
reported and only reconciles those.

### `'gone'` keeps no consumer, deliberately

The difference between `reconnecting` and `gone` is a deadline passing, and
nothing here turns on the deadline: the round stops waiting the instant
`player/left` lands, not sixty seconds later. Giving `seatState` a consumer would
mean threading room time into a pure selector — `submissionRows(state, now)`,
plumbed from `useCountdown` in two screens — for a distinction no behaviour
reads. It earns one the day something *reaps* a held seat, which is a separate
decision with its own consequences for the rotation and the scoreboard.

## What deliberately did not change

- **`tally`, `history`, `standings`, `podiumPlaces`.** A dropped player's entry
  stays in `round.entries`, so it is still voted on, still scored, still theirs.
  `reconnectCopy` already promises the room this — *"Your points aren't going
  anywhere"* — and now something enforces it.
- **`beginRound`'s rotation and `nextRoleHolder`.** See above.
- **`canStart` / `MIN_PLAYERS`.** The lobby is before anybody has dropped, and
  gating the start button on presence makes a flaky guest un-startable.
- **`authorize`'s actor lookup.** A `reconnecting` player must still be found,
  or `player/reconnected` becomes unauthorizable.

## Consequences

- `competitors()` still lists everyone but the role holder — a dropped player
  stays **visible** in the tracker, because a row vanishing mid-round while
  their card is still in the vote grid is the worse read. `activeCompetitors()`
  is the new one, and it is what the counts and `waitingCopy` read.
- The tracker has a third status, `left`. `docs/design-system.md` §5 argues that
  "two honest states beat three with one of them guessed" about `typing…`; this
  is the opposite case — `left` is the one thing on that row the room knows for
  a fact, straight off presence.
- `AblyTransport.close()` no longer leaves a rejected `presence.leave()`
  uncaught. It fired *every time a tab closed*, which is how every session ends.
  One `fire()` helper wraps each of the eleven unawaited promises in the file
  and stays silent only after `closed` is set; before that a rejection is a real
  failure and still says so.
