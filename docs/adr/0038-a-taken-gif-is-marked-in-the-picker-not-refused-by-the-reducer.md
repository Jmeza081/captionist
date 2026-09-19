# 0038 — A taken GIF is marked in the picker, not refused by the reducer

**Status:** accepted · 2026-09-14

Implements `docs/backlog.md` §2.1. Applies
[ADR 0032](./0032-a-blocked-label-counts-what-is-missing.md) to a reason that
lives off-screen.

## Context

In `react` mode every competitor answers the Prompter's line with a GIF, and
two of them picking the same one makes the round worse: the vote grid shows the
same picture twice and the joke is split.

The obvious place to stop it is `authorize`, beside every other rule. That is
the wrong place, for three reasons that are all about what a refusal costs:

- **`BotPool` has no retry path.** It marks a phase done *before* awaiting and
  discards the boolean `apply()` returns, so a bot refused for a taken GIF
  would simply never submit — and the compose gate (`inHand >= roster.length`)
  would strand the round until the clock ran out.
- **The offline shelf is twelve tiles.** `sampleAt` is a positional shelf and
  it is the road the whole Playwright suite and any keyless clone take, so bots
  would collide constantly in exactly the configuration every test runs in.
- **A refusal after the fact is the worst moment in a picker.** The seat-map
  pattern — you chose, then you were told no — is what this feature exists to
  avoid, not to relocate.

## Decision

**The rule lives in the UI.** `takenMedia(state, viewerId)` reads
`round.entries`, which every client already holds: `project()` redacts authors
only once voting opens, so during `compose` the set is derivable with **no new
wire traffic**, and it moves on the next `rev` like everything else.

**A taken tile is marked, never removed.** Both providers forbid reordering,
suppressing or filtering a board, so the tile keeps its place and wears
`MediaCard`'s own-entry treatment — picture dimmed, scrim, a `Taken` pill. Not
`Chip.blocked`'s `opacity: 0.3`, which erases the GIF; being able to see what
was taken is the point of marking rather than hiding.

**It stays a button.** `aria-disabled` rather than `disabled`, so the tile
holds its place in the tab order and a reader who lands on it hears
`"Taken. {alt}"` — the fact before the description. The handler refuses; the
control does not go inert. Nobody is named on it: entries are anonymous until
the reveal, and a name on a tile is also a voting hint.

**A staged pick that gets taken is derived out, not cleared.** `stagedTaken` is
a function of the board, so the ring and the lock read off it directly rather
than through a `setState` in an effect. One warning snackbar fires on the
transition — to the one person it happened to, never one per taken tile.

**A same-instant collision is accepted.** Two locks inside one broadcast
round-trip both land, and the reveal shows two identical cards. Refusing the
second is the reducer rule this ADR declines.

## Consequences

- `GifPanel` and `RoundPicker` take a `taken?: ReadonlySet<string>`. The set is
  the screen's to assemble; only the answer face has one.
- `mediaKey` in `lib/media.ts` is what makes two `MediaRef`s the same GIF —
  everything from `?` or `#` onward is dropped. Klipy's URLs compare cleanly;
  Giphy's carry per-request `cid`/`rid` parameters, so two players who searched
  separately would otherwise never match.
- `RoomShellApi.notify` takes an optional `SnackbarTone`. It was confirm-only,
  and the warning lane belonged to room refusals alone; this is the first thing
  that happened *to* a player rather than being refused of them.
- `?submitted=n` is a fixture lever: how many competitors have already answered
  when a `compose` fixture boots. Capped one short of the field, or the last
  entry flips the phase to `waiting`.
- **If the rule ever moves into `authorize`**, `BotPool.answer` needs a re-pick
  loop first and the stub corpus needs to outnumber the roster. See
  [ADR 0034](./0034-a-bot-is-the-hosts-puppet-not-a-peer.md).
- `caption` mode is unaffected: one GIF, one picker, nothing to collide.
