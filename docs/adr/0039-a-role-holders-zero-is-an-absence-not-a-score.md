# 0039 — A role holder's zero is an absence, not a score

**Status:** accepted · 2026-09-20

## Context

The scoreboard reports what each player earned in the round that just ended.
`RoundResult.points` is keyed by player, and every player who did not score is
simply missing from it — so `points[id] ?? 0` is the natural read, and it gives
`0` for two completely different people:

- a competitor who submitted an entry and drew no votes, and
- the round's **role holder**, who never had an entry to vote for. The rule is
  stated in the glossary: *"Does not compete. Sets the round up, sits it out,
  then votes."*

Rendered identically as `+0`, the second reads as the first. On a scoreboard,
next to competitors who scored, a zero is a verdict — and the role holder was
never eligible for one. It is the row most likely to be misread, because it is
the one player in the room with a legitimate reason to have nothing.

The same shape had already been settled once next door: [ADR 0015](0015-a-progress-screen-may-not-invent-a-stage.md)
refuses to let a screen draw a stage the room is not in, and
[ADR 0037](0037-a-round-nobody-voted-in-has-no-winner.md) refuses to crown
"Nobody" as a player. Both are the same instinct — do not let a rendering
default state something the game did not.

## Decision

`Standing.delta` is `number | 'out'`. The role holder of the round being
scored gets `'out'`; everyone else gets their points, zero included.

`PlayerRow` draws `'out'` as an em dash with `Sat this round out` in
screen-reader-only text, and a real zero as a dimmed `+0`. The note column says
`Set this round up` — mode-neutral wording, because a Captionist supplies a GIF
and a Prompter supplies a prompt and both of them set the round up.

The distinction is made in the selector, not the screen. `standings()` already
knows who holds the role; a screen re-deriving it would be a second place for
the rule to drift.

## Consequences

- **A dimmed `+0` now means something specific**: you competed and scored
  nothing. It is worth keeping rather than blanking, because it is exactly what
  the em dash has to be told apart from.
- The role holder is identified from `state.round.roleHolderId`, which is still
  the finished round's holder at `score` — `round/advanced` is what replaces
  `round`. At `podium` it is `null`, so nobody is marked as sitting out on the
  final standings, which is correct: the game is over and no round is being
  reported.
- `Standing.delta` is a union, so anything new that consumes it has to decide
  what an absence means rather than adding it to a total by accident. The
  export's `standingsRow` does not read it at all and is unaffected.
- If prediction scoring ever lands ([backlog §2.5](../backlog.md)), it changes
  this rule's premise rather than its implementation: a role holder who can
  score is no longer sitting the round out, and `'out'` should disappear rather
  than be worked around.
