# 0016 — A media card is square, and a caption scales with it

**Status:** accepted · 2026-08-29

## Context

`CLAUDE.md` states the rule this ADR is an exception to, and states it
absolutely: *"`design/` is the design source of truth. `theme/` copies its
values verbatim; if code and design disagree, the code is the bug."* That rule
has been right every previous time it was tested, which is why it is worth
writing down the one time it was not.

DESIGNSYSTEM.md §3 draws a media card's image at a fixed **170–210px height**
and its caption overlays at **14–32px**. Both numbers were copied verbatim, and
the implementation took the floor of each: 186px and 14px.

The trouble is that a height is only a shape if you also know the width, and
the card is laid out at four of them — 307px in the vote grid, 520px in the
compose preview, 313px on a phone, 570px on the 404. At 307×186 a meme card is
a **1.6:1 letterbox**. The compose preview was the tell: it is the largest
thing on the screen a player is captioning, and it left half its own column
empty underneath itself. The caption inherited the same mistake from the other
direction — 14px centred over a 307px tile is a label, not the joke the whole
game is about.

Neither number is wrong in the design. The prototype draws these cards inside a
layout we do not use, and a fixed height that was right there survives the move
as a value with nothing holding it accountable.

## Decision

**A media card's image is a ratio, not a height.** `$media-ratio: 1 / 1`
governs every width from one number, so the card is the same shape in a
three-up vote grid and on a page of its own. Changing the product's mind is one
line.

**A caption is sized against the card, not the viewport.** `$media-overlay-size`
is `clamp(1.375rem, 8cqw, 2.625rem)` and `.frame` declares
`container-type: inline-size` to make `cqw` mean anything. The unit is the
decision, not the numbers: a 307px vote tile and a 570px hero card share a
viewport, so a `vw` clamp gets at most one of them right. The ceiling is 42px,
above the design's stated 32.

**A departure from `design/` is recorded, never silent.** Each of these three
values — ratio, size, shadow — is a row in a table in `docs/design-system.md`
naming what §3 says, what we ship, and why. The rule in `CLAUDE.md` still
stands: the *default* is that the code is the bug. What this ADR adds is that
the exception has a place to be written down, so the next person reads the
reason instead of restoring the letterbox.

## Consequences

**Every screen holding a `MediaCard` got taller**, which on a phone means the
vote grid is roughly one card per screen instead of two. Voting is a
scroll-and-rank task and the cards are now legible as memes, so this is a trade
made knowingly rather than a side effect noticed later.

**A merged-or-not gate had to say what it meant.** Square cards pushed the
first vote card's foot row under the vote screen's sticky lock dock, and
`e2e/targets.spec.ts` failed — which turned out to be the test's proxy showing
its seams rather than a defect in the layout. That is its own decision, with
its own costs, and it is
[ADR 0017](./0017-a-buried-control-is-not-a-stolen-tap.md).

**`$media-height` and `$media-height-lg` are gone**, and a `MediaCard`
`size="lg"` prop that briefly existed to reach the second one went with them: a
ratio makes both redundant, and a vestigial prop is a thing that drifts.

**The 404's GIF was chosen to fit the crop.** `object-fit: cover` on a square
card throws away half the width of a 2:1 source, so `lib/gifs/notFound.ts`
carries a 320×320 cut of the meme rather than the 500×251 one. Any hard-coded
art added later inherits that constraint.
