# 0017 — A buried control is not a stolen tap

**Status:** accepted · 2026-08-29

## Context

`docs/design-system.md` §6 lists the accessibility floor as *"merged-or-not
conditions"*, and one of them has a test standing behind it rather than a
convention:

> **Never apply `tapTarget` inside a dense row or grid.** Two grown areas that
> overlap steal each other's taps […] `e2e/targets.spec.ts` measures the real
> hit areas on a phone and fails on any overlap; it is the load-bearing half of
> this rule.

The mechanism is `theme`'s `tapTarget` mixin: a control keeps the size the
design draws it at, and a centred `::after` grows its hit area to 44px. That
buys the floor without redrawing the design, and it has exactly one failure
mode — two grown areas that overlap, where the one on top silently answers a
tap meant for the other. The file's own header says so. The bug that motivated
it is named in a comment: the vote screen's full-width lock button ran under
the floating chat key, so the right end of "Lock my ranking" opened chat.

The test implemented that as *no two hit rectangles may intersect*, sampled at
scroll zero on three screens. That is a proxy, and [ADR
0016](./0016-a-media-card-is-square-and-a-caption-scales-with-it.md) is what
made the gap between the proxy and the rule visible. Squaring the media card
pushed the first vote card's foot row down into the band where the lock dock
sits, and the test failed with four clashes.

**The dock is not a floating key.** `.lockDock` is `position: sticky; bottom: 0`
over a background that goes fully opaque, and its own comment says why that is
not a fade: *"the button sits over a scrolling grid, so it needs real ground
under it — a gradient that only fades would leave caption text legible through
it."* The foot row was not being stolen. It was behind a wall, invisible, and
one scroll away from being in the open.

Two things follow, and the second is the uncomfortable one. A sticky bar over a
scrolling grid **always** buries some card's controls, at almost every scroll
position — this was as true before the card changed shape as after. And the
suite had been passing not because the layout was clean but because short cards
happened to clear the dock at the one scroll offset the test samples.

So the choice was not "fix the layout or weaken the test". It was: decide what
the rule means, having found out the test had never quite meant it.

## Decision

**The rule is about controls a viewer can see.** `e2e/targets.spec.ts` drops a
control from the comparison when *every* one of five sample points — its centre
and its four corners — resolves through `elementFromPoint` to an element that
is neither the control, nor inside it, nor an ancestor of it, and that element
paints a background of its own. Anything less than total occlusion still
counts.

Three properties of that shape were deliberate:

- **Five points, not one.** The motivating bug had an unoccluded centre and a
  buried right end. A centre-only check would have dropped it.
- **The occluder must paint.** A transparent overlay covering a control is a
  different bug — the control is dead rather than hidden — and the filter must
  not launder it into a pass.
- **Ancestors do not occlude.** A control inside a painted parent is still on
  offer; only something *on top of* it is not.

**A narrowing of a merged-or-not gate gets verified, not asserted.** Before
this landed, `.lockDock`'s `padding-right` — the fix for the original bug — was
reverted by hand and the test was confirmed to fail with
`vote: "Pick 3 more" over "Guest toolbox"`, then restored. That is the check to
repeat if this rule is ever loosened further; a filter that no longer catches
the bug the file was written for is a filter that has eaten its own test.

## Consequences

**Content under a sticky surface is out of scope, permanently.** This is the
real cost and it should be stated plainly rather than discovered: if a future
sticky or fixed surface covers a control that the user cannot reach by
scrolling, this test will not say so. It measures overlap between visible
controls, not reachability. The room has one such surface today — the vote
screen's lock dock, whose grid scrolls freely underneath it — and adding a
second is the moment to re-read this ADR rather than assume the gate still
covers you.

**The scroll-zero sample is still a sample.** The test checks three screens at
one offset each. It was never a proof and is less of one now; what it is, is a
cheap standing guard against the specific mistake `tapTarget` makes easy.

**§6's wording moved with it.** `docs/design-system.md` now says the test
ignores a control completely behind painted ground, and why. The two have to
stay in step: the prose is the rule, the spec is the enforcement, and a reader
who finds them disagreeing should trust neither until someone reconciles them.
