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

## Amendment · 2026-08-30 — a caption scales with the card *and* with itself

The decision above is unchanged: the overlay is sized in `cqw` against the
card, not in `vw` against the window. What changed is that one size was not
enough.

**The problem this missed.** `clamp(1.375rem, 8cqw, 2.625rem)` is the right
size for a caption of a few words and the wrong size for sixty characters. At
the ceiling a card fits about twenty characters to a line, so `CAPTION_MAX`
was four lines of poster type — and the two overlays share one frame, so the
top one grew down through the bottom edge where `.frame`'s `overflow: hidden`
cut it in half without saying so. What the player saw while typing was a
caption losing its own second half.

**The decision.** The size is one of four steps, chosen by the caption's
**character length** rather than by measuring it: `$media-overlay-size` for one
line, `$media-overlay-size-2/-3/-4` below it, each roughly the one above
divided by its own line count so the block of text stays about the height a
single line was. `overlayStep` in `MediaCard.tsx` does the arithmetic against
`CHARS_PER_LINE` (20), which lives beside it rather than in `theme/` — no
stylesheet can read it, and a token nothing consumes drifts from the number that
actually runs.

**Length, not measurement, and that is the point.** Measuring means a layout
effect, a ref, and `'use client'` on a component that four screens render and
none of them need interactive. Character count works *because of the original
decision*: the type is sized in `cqw`, so a card holds about the same number of
characters per line whatever its pixel width — a 307px vote tile and a 550px
compose preview wrap at the same word. The `cqw` unit is what makes the cheap
answer the correct one. Anyone tempted to "fix" this with `useLayoutEffect` and
`scrollHeight` should read that sentence again first.

## Consequences

- **`MediaCard` stays a server component.** The whole point of the paragraph
  above.
- **The steps are approximate, so the frame still needs a floor.** The overlay
  carries `max-height: calc(50% - 10px)` and `overflow-wrap: anywhere`: neither
  overlay may take more than half the frame, and a single unbroken word — a
  package name, a stack frame — breaks rather than running off both sides. The
  steps mean that ceiling should never be reached; it is the backstop, not the
  mechanism.
- **Twenty characters per line is a measured constant, not a magic number**,
  and it is wrong the moment the overlay's font, weight, or `letter-spacing`
  changes. `theme/_metrics.scss` carries a comment beside the sizes saying so
  and pointing at where the number lives, because the coupling is real even
  though the value cannot be a token.
- **`e2e/compose.spec.ts` asserts the ladder rather than the sizes**: that each
  step is smaller than the last, that the text stays inside the frame's box,
  and that an unbreakable word does not overflow. Pinning the pixel values
  would break on every legitimate type change.
