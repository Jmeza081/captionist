# 0021 — The room's limits are a rate limit, not a game design

**Status:** accepted · 2026-08-31

## Context

[ADR 0020](./0020-giphy-is-called-from-the-browser.md) removed the proxy and its
hour-long cache, because Giphy's terms forbid both. That cache was doing more
work than anyone had priced. With it, a board cost one upstream call an hour for
the whole room. Without it, every player's picker is its own call.

A beta key allows **100 calls an hour**. A production key is a negotiated
contract Giphy will not quote without an application, and they have just
absorbed the entire Tenor migration.

Measured against the clocks in `constants.ts` — a round is ~215s at the default
90s `capSeconds`, so continuous play is ~13.5 rounds an hour — the app as it
stood spent far more than that:

| | Calls/hour |
| --- | --- |
| 20 players, 5 rounds, `react` | ~1,040 |
| 10 players, 5 rounds, `react` | ~500 |

Three of the call sites were waste rather than product:

- **`BriefScreen` fetched on all four of its views.** `pick` draws a board;
  `prompt`, `pickwait` and `promptwait` do not. The hook sat above the early
  returns, so in `react` mode every player in the room spent a call each round
  watching somebody else type.
- **`ComposeScreen` fetched on all four of its views**, so a `caption` room paid
  a call per competitor per round for a picker nobody was shown.
- **`ChatPanel` fetched on mount**, for every player, on joining the room,
  whether or not they ever opened the picker.

And `LIMIT` was 12 against a documented ceiling of 50.

## Decision

**The room is sized against the free tier**, and the levers are chosen so the
game loses as little as possible — accepting one place where the game wins and
the allowance does not.

- **A board of fifty.** `LIMIT` 12 → 50, Giphy's maximum and Klipy's. A board of
  fifty costs exactly the same one call as a board of twelve, and every tile on
  it is a search somebody now does not run. This is the change that pays for the
  others.
- **The hook is lazy.** `useGifSearch({ enabled })`, wired to `viewKey`, so only
  `pick` and `submit` ever fetch. `ChatPanel`'s picker is removed outright.
- **Three searches per competitor per round, and the arrival board is free.**
  Charging for the board you land on would mean the counter opened at one less
  than it said, and arriving at a picker is not a choice anyone made. Client
  state, because it is a rate-limit guard and not a game rule — nobody gains by
  evading it.
- **`surprise` is free.** It reads a random tile off the fifty already in memory
  instead of fetching a random page.
- **`shuffle` is gone.** Paging to the next twelve made sense at twelve. At
  fifty it is redundant with searching, and it was a third drain on the budget.
- **`MAX_PLAYERS` 20 → 10, `ROUNDS_MAX` 10 → 5.**
- **Room size is a host setting, and it bounds the round count.** `roundsMaxFor()`
  is the whole cost model in one function: the role holder sits out, so a room of
  `size` fields `size - 1` competitors, each opens a picker every round, and
  seats × rounds is what the allowance buys.

  | Room size | Max rounds |
  | --- | --- |
  | 3–7 | 5 |
  | 8–9 | 4 |
  | 10 | 3 |

  Sized against **realistic** use — two of the three searches spent, so three
  calls per competitor per round — rather than the ceiling. Sizing against the
  ceiling would allow a ten-player room two rounds, which is barely a game, and
  it would be sizing against a room where every person exhausts every search
  every round. A room that beats the assumption ends early on the podium saying
  why, which is what makes an estimate safe to use here.
- **Running out ends the game.** `game/gifsExhausted` lands on the podium the
  way `host/jumpedToPodium` does, with `endedBecause: 'gifs'` so the podium can
  explain itself.

That leaves a round costing at most `1 + 3` calls a seat, and a `react` game at
ten players and five rounds:

| | Calls/game |
| --- | --- |
| Floor — everyone takes the board they land on and never searches | **45** |
| Realistic — about one search each | ~90 |
| Ceiling — every competitor spends all three, every round | **180** |

`caption` mode is 5 to 20, because only the Captionist touches the API — it is
unconstrained at any roster size.

**The ceiling is over the free tier, deliberately.** A ten-player room capped
at three rounds still ceilings at 108 — nine competitors × three rounds × four
calls — against 100 an hour. Realistically it spends ~54. That gap is the
priced trade: three searches is what makes a mode whose whole loop is hunting
worth playing, running out is a designed ending rather than a broken picker,
and the room is in beta. A production key is the answer if the game earns one.

## Consequences

**A full `react` room does not finish on the free tier.** Ten players, five
rounds, everyone hunting: the allowance goes around round three. `caption` mode
and small `react` rooms are unaffected. This is the accepted cost of a search
budget that is generous enough to play with, and it is why the ending is a
punchline rather than a broken picker — `game/gifsExhausted` is a designed
outcome, not an error path. It is also the concrete thing that would justify
applying for a production key.

**Any seated player may end the game.** `game/gifsExhausted` is deliberately not
in `HOST_ONLY`, because only the client that received the 429 can observe it and
that is rarely the host. In a party game for one team the griefing risk is not
worth an authority mechanism.

**Search is a resource, and the counter must lead.** The suggestion chips read
as free taps and each one spends a search, so `GifPanel` shows what is left
*before* the first tap rather than after the last. Blocked, never disabled —
`Chip` gained the `blocked` prop `Button` already had.

**Fifty tiles made lazy loading mandatory.** Fifty animated GIFs decoding at
once on a phone is tens of megabytes, so the tile prefers the `webp` rendition
and carries `loading="lazy"`. Raising `LIMIT` without that would have traded an
API bill for a data bill.

**Chat lost GIF replies**, and the staged-attachment state went with them.
Nothing could put a value in it once the picker was gone, so keeping it would
have left a `useState` that could only ever hold `undefined` — the same
scaffolding-for-an-absent-feature that
[ADR 0014](./0014-uploads-are-not-a-feature.md) removed. Image reactions still
post attachments; they carry theirs inline.

**Five rounds at ten players means only five people ever hold the role.** Half a
full room never sets a round up, and setting one up is a distinct part of the
game. This is the sharpest product cost here and it is a consequence of the cap,
not a design preference. If a production key is ever bought, this is the first
number to raise.

**`e2e/gifs.spec.ts` is the guard.** It intercepts `api.giphy.com` and asserts
the per-round budget exactly — one call to arrive, one per search, nothing for
the fourth. A page only ever sees its own seat's calls, so a whole-game total
from one browser would look like proof without being any; the game figures
above are that budget times the roster. Any of these numbers moving should move
that test first, and if the two disagree this ADR is out of date.

**The reasoning is invisible in the constants themselves.** `MAX_PLAYERS = 10`
looks like a game-design choice and is not, which is why it carries a comment
pointing here. The design draws a twenty-player room; nothing about the round
engine minds one.
