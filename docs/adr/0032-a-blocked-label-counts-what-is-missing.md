# 0032 — A blocked label counts what is missing, it does not narrate the empty state

**Status:** accepted · 2026-09-02

Refines `docs/design-system.md` §4 rule 7 and `CLAUDE.md` rule 10, which stay
as written; this draws the line inside them.

## Context

The rule is one of the app's non-negotiables, and it is a good one:

> **Blocked is not disabled.** An unavailable action keeps its control live and
> focusable, and says what's missing in the label ("Pick 2 more").

Every committing control in the room was built to it, and three of them read
like this while nothing was staged:

| Screen | Blocked label | Ready label |
| --- | --- | --- |
| Brief, picking | Pick one first | Lock it in |
| Composer, answering | Pick one first | Lock in my answer |
| Composer, captioning | Write something first | Submit caption |
| Vote | Pick 2 more | Lock my ranking |

Design review rejected the first three and kept the fourth, which is a sharper
result than "shorten the copy". The reasoning that came back was that the board
of fifty un-ringed tiles, and the empty field with its own `0 / 60` counter, are
each *already* the answer to "what's missing" — at full size, in the middle of
the screen, where you are looking. The label was restating them in eight
characters at the bottom.

It also cost something measurable. Those labels change length twice a round, so
the one control that ends the phase changed width as you worked — and on a phone
the picker's foot wrapped to two lines, which moved the button itself.

"Pick 2 more" is doing something none of the others were. The vote screen shows
three empty rank slots and eleven cards; **two** is a fact you cannot read off
either, because it depends on how many of the three you have already filled. The
label is the only place that number exists.

## Decision

**A blocked label states a count the screen does not already show. Where the
missing thing is simply "you have not started", the label stays the action.**

So `RoundPicker` lost its `blockedAction` prop and `ComposeScreen` its
`'Write something first'`; both now render `copy.action` at every moment.
`VoteScreen` keeps `gate.label` unchanged.

**`blocked` itself is untouched, on all four.** The control stays live,
focusable and visibly held back; `aria-disabled` and the tint still say it is
not ready. What changes is only whether the *text* repeats what the screen has
already said. Nothing here weakens the half of the rule that exists to stop
`disabled` attributes appearing.

The test for a new control is the one question: **is there a number, or a
named requirement, that the viewer cannot see anywhere else on the screen?**
If yes, the label carries it. If the answer is "the thing above this is
empty", the label is the verb.

## Consequences

**Two shapes of blocked control now exist, deliberately.** Anyone adding a
third has to decide which it is, and the table above is the precedent. Without
this ADR the split reads as drift — one screen following the rule and three
quietly not — which is exactly how a rule stops being enforceable.

**Rule 7's example is now also its boundary.** "Pick 2 more" was always the
illustration in the guide; it turns out to be the definition. That is worth
saying out loud, because the rule as written could be read as "every blocked
label narrates its state", and three screens read it that way.

**The empty state has to carry its own weight.** This decision is only sound
while the board visibly shows nothing selected and the field visibly shows
nothing typed. A future screen whose blocked reason is *not* visible — a
control gated on something off-screen, or on another player — falls on the
other side of the line and takes a counting label.

**`e2e/brief.spec.ts` and `e2e/compose.spec.ts` assert the label is stable**
across the staged/unstaged transition, so a revert would fail rather than
silently drift back.
