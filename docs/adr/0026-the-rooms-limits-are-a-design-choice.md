# 0026 — The room's limits are a design choice, not a rate limit

**Status:** accepted · 2026-09-01 · supersedes
[ADR 0021](./0021-the-rooms-limits-are-a-rate-limit.md)

## Context

[ADR 0021](./0021-the-rooms-limits-are-a-rate-limit.md) sized the entire room
against Giphy's beta allowance of **100 calls an hour**. It said so in its own
title, and it was right to: with the proxy and its hour-long cache removed by
[ADR 0020](./0020-giphy-is-called-from-the-browser.md), every competitor's
picker became a live API call, and a twenty-player `react` game spent about
1,040 calls an hour against an allowance of 100.

So the room was cut to fit the bill: `MAX_PLAYERS` 20 → 10, `ROUNDS_MAX` 10 →
5, `roundsMaxFor()` coupling the round count to the roster, `SEARCHES_PER_ROUND
= 3`, no paging, and no GIF picker in chat.

[ADR 0022](./0022-the-gif-provider-is-a-seam.md) made the provider a seam and
moved the app to Klipy, and found that a Klipy **production** key is free and
unmetered — ad-funded rather than licensed. It deliberately did not move the
numbers:

> Removing a premise is not the same as taking a decision: the caps are still
> enforced, so they are still documented here. They should change deliberately,
> against measured usage rather than a model, and under their own ADR — and at
> that point they are game design rather than a rate limit.

**The production key has been approved.** This is that decision.

## Decision

**Every cap that was arithmetic on an allowance is either removed or re-set as
a game-design number, and the app stops pretending otherwise.**

- **`MAX_PLAYERS` 10 → 20.** Back to what `design/` draws and what the landing
  page, the README and `CLAUDE.md` have all claimed throughout. ADR 0021 named
  this as the first number to raise if a production key were ever bought.
- **`ROUNDS_MAX` 5 → 10**, its pre-ADR-0021 value.
- **`roundsMaxFor()` is deleted**, with `HOURLY_ALLOWANCE` and
  `ASSUMED_CALLS_PER_COMPETITOR_ROUND`. Room size and round count are
  independent settings. The reducer still clamps, but each value into its own
  bounds rather than one against the other — every road in (the setup screen,
  a URL lever, a fixture) should still land on a legal room.
- **`SEARCHES_PER_ROUND` is deleted.** Searching is unmetered. `GifPanel`'s
  counter and the `blocked` state on its suggestion chips go with it.
- **"Shuffle results" comes back**, as `useGifSearch().more()`. ADR 0021 cut it
  as "a third drain on the budget" and kept `GifCursor` alive for the day it
  returned; this is that day.
- **Chat gets its GIF picker back**, mounted lazily.
- **`DEFAULT_SETTINGS.totalRounds` 3 → 5**, which is the game every piece of
  copy in the repo describes. It was 3 only because that is what ten seats
  afforded.

### What does *not* change

**ADR 0020 stands entirely.** Klipy is still called from the browser, with a
public key, with nothing caching it, and with nothing filtering or reordering
what comes back. This ADR moves numbers; it touches no part of that
architecture, and none of Klipy's seven integration requirements are affected
by anything here.

**`game/gifsExhausted` stays.** A 429 is no longer expected — that is the whole
point — but *unmetered is not infinite*, and a picker that silently stopped
working would be worse than the designed ending. `GifQuotaError` still lands on
the podium with `endedBecause: 'gifs'`. The cost of keeping it is one action
and one modal; the cost of removing it is a failure mode with no path out.

**`lib/gifs/usage.ts` stays, and matters more than it did.** With the search
budget gone it is the only thing counting what a full room actually spends. The
read-out is on `/components`.

### Why not measure first

ADR 0022 asked for measured usage, and this decision does not rest on any.
That is deliberate rather than a shortcut: **measurement was needed to justify
the application, not the removal.** Every one of these caps is a quotient with
`HOURLY_ALLOWANCE` in the denominator, and when the denominator goes the
quotient is not a smaller number — there is no longer a division to do. A
measured average would not tell us what `MAX_PLAYERS` should be; the design
already answers that, and it says twenty.

Where measurement still governs is the part that is not arithmetic — whether a
twenty-player room is *pleasant* — and that is a question for a played game,
not a spreadsheet.

## Consequences

**The vote board is the new binding constraint.** `react` at twenty players
puts nineteen submissions in front of a room that has to rank three of them.
Nothing in the round engine minds, and the design draws seven. This is the
reason `MAX_PLAYERS` is twenty rather than higher, and it is worth re-checking
before anyone raises it again. `?bots=19` reaches it — `MAX_BOTS` was already
19, sized for exactly this and unreachable until now.

**Everybody can hold the role again.** ADR 0021 called it "the sharpest product
cost here": five rounds at ten players meant half a full room never set a round
up. Ten rounds at twenty players does not fix that arithmetic on its own — it
makes it the host's to choose, which is what it should always have been.

**A long game is now possible to configure.** Ten rounds at the default 90s cap
is roughly half an hour. That is a real thing a host can do to a room, and the
app does not stop them. The clock, not the allowance, is the honest limit.

**`PLAYER_COLORS` cycles harder.** Seven colours across twenty seats means each
appears about three times. Colour was never the only thing telling two players
apart — the face and the name carry that — but the vote board leans on it more
than other screens, and it is the first place a real twenty-player game should
be looked at.

**One copy string stopped naming a vendor.** The podium's out-of-GIFs modal
said "We hit Giphy's hourly limit" and was shown when *Klipy* exhausted. It is
provider-neutral now. Which provider answered is a build setting the player
never chose, the message is identical either way, and a string that has to be
kept in step with a vendor swap is the exact drift ADR 0022 removed everywhere
else.

**`Chip`'s `blocked` prop lost its only production consumer** and stays. The
contract belongs to the design system — `Button` has the same one, for the same
reason — and the gallery is where it is demonstrated now. Its doc comment no
longer claims the picker needs it.

**`GifBoard` gained `hasMore`.** "Shuffle results" wraps to the first page at
the end of a thin result set rather than dead-ending on an empty board. Klipy
answers this directly with `has_next`; Giphy does not, so its adapter infers it
from a full page — **counted off what was returned, never off what was
drawable**, or one page of undrawable items would report itself as the end of
the results.

**Chat's picker is lazy, and that is load-bearing.** ADR 0021's actual finding
about `ChatPanel` was not that a picker is expensive but that *mounting one on
join* was: every player paid a call for a surface they might never open. The
picker returns behind `useGifSearch({ enabled })`, so the call follows the tap.
That would be the right shape even if calls were free, which is why it is not
written as a concession.

**`GifPanel`'s popover is now fed by a provider, and must not filter.** The
component narrows a locally-supplied list by keyword, which is fine for a list
of ours and is precisely the client-side filtering both providers forbid for
theirs. `GifPanel` already keys that off `provider` as well as `onSubmit` —
commit `0826dd7` anticipated this exact change — so passing `provider` from
`ChatPanel` is mandatory rather than cosmetic.

**`e2e/gifs.spec.ts` moved first.** ADR 0021 said any of its numbers moving
should move that test before anything else, and that if the two disagree the
ADR is out of date. The budget group now asserts the *absence* of a counter and
that a fourth search still fetches; the per-call accounting and the 429 ending
are unchanged.

**ADR 0021 is superseded, not deleted.** Its reasoning is the best record of
what the free tier cost this app, and the note it carries about Klipy now
points here.
