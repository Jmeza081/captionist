# 0031 — The keys are cleared above the bar, not beside it

**Status:** accepted · 2026-09-02

Amends [ADR 0017](./0017-a-buried-control-is-not-a-stolen-tap.md), which is
about the same corner of the same screens and stays accepted; what changes is
which axis pays for it.

## Context

Two 44px keys float in the bottom-right of every in-room screen on a phone —
chat's collapsed rail and the toolbox. They are `position: fixed`, so anything
that scrolls under them is, for as long as it is under them, untappable.

The motivating bug is named in ADR 0017 and in a comment that outlived it: the
vote screen's full-width lock button ran beneath the floating chat key, so *the
right end of "Lock my ranking" opened chat*. The fix was to clear the keys
**sideways** — the content column reserved a whole key's width on both sides, so
nothing in the column could ever pass under one:

```scss
--room-column-pad: calc(#{t.$space-8} + #{t.$tap-target-min}); // 52px
```

That is an absolute guarantee, and it holds. It costs 104px of a 393px phone.
Design review put the number in front of us from the other side: cards, the GIF
board and the media frames were the things the room is *made of*, and they were
each 26% narrower than the glass to protect a control that appears on four
screens out of ten. The reservation is also invisible in the thing it protects —
nobody looking at the lobby can tell that the gutter is a key's width rather
than a designer's.

Dropping it outright was tried first, at `$space-8`. That is what surfaced the
real distinction: the complaint that came back was not "a key covers a card", it
was that **words** sat on the edge of the glass. Nobody minded a key passing
over a picture. What no one would accept is a key on the button that ends the
phase.

So the question stopped being "how wide a gutter" and became: *which* controls
actually need the guarantee, and is there a cheaper axis to buy it on.

## Decision

**The gutter is `$space-20` and the keys are cleared vertically.**

Twenty is the same value `/`, `/host` and `/join` were already using, so the
room and the front door agree for the first time; it is on the spacing scale,
where 16 is not (DESIGNSYSTEM.md §2); and it hands 32 of the 44 reserved pixels
back to the content. `--room-dock-right` matches it, so a key's right edge and
the content's right edge are one line rather than two twelve pixels apart.

The guarantee moves to the control that needs it. A screen with a committing
action puts it in a sticky bar and marks that bar `data-action-dock`; the shell
reads the mark with `:has()` and lifts the whole key column above the bar:

```scss
.shell:has([data-action-dock]) {
  --room-action-dock: calc(#{t.$btn-form-height} + #{t.$space-14});
  --room-dock-base: calc(var(--room-action-dock) + #{t.$space-8});
}
```

A `:has()` selector rather than a prop threaded through React, because the fact
is the screen's and the two consumers are `position: fixed` elements nowhere
near it in the tree — a third screen growing a bar is one attribute rather than
a new prop on the shell. `data-action-dock="noted"` is the one variant, for the
lobby's bar, which carries a line under its button.

Four of the ten phases can carry one — the lobby, the brief while it is
picking, the composer while it is *answering with a GIF*, and the vote — and in
the middle two it is the face rather than the phase that decides: caption-mode
composing is a form, and a form's submit sits in the column with its fields.
Three components declare the attribute, because `RoundPicker` draws two of
those four faces.

The lobby's is new, and it is new *because* of this decision. Its start button
was protected by the gutter alone; without one it landed under the chat key at
the position the lobby paints at, and the phone layout that arrived in the same
pass put it at the foot of the column, where a bar belongs anyway.

## Consequences

**An ordinary control can pass under a key again, mid-scroll.** A board tile, a
vote card's "Rank this", the duel's "Vote this one". A nudge of the page frees
any of them, which is how page content behaves under a floating action button in
every app that has one. This is the cost, stated plainly, and it is the thing to
reopen if it turns out to bite.

**`e2e/responsive.spec.ts` had to narrow its claim, and says so.** It asserted
*no control is ever under a key, at any scroll position of any screen* — which
was true only because of the reservation this ADR removes. It now asserts the
half that survives: the phase's own bar is never covered while it is at the
foot. `e2e/targets.spec.ts` keeps the stronger line where it can still be held —
nothing overlaps at the position each screen actually paints at, which is what
caught the lobby's start button and sent it into a bar.

**Two numbers became load-bearing, and both were wrong before they were right.**
`--room-column-foot` is what the content column reserves at its foot, and a
sticky bar negates exactly that to come to rest on the end of the column. The
bar used to negate the phone's figure at every width, which above `md` overshot
the real padding by 62px and hung the bar below the scrollport. And above `md` a
screen carrying a bar reserves nothing at all, because there the *column* is the
scroller and a scroller's own bottom padding pushes a `bottom: 0` sticky child up
by that much — the vote's lock button sat 78px above the fold at every scroll
position until that was found. Neither had a test; both do now.

**A bar's height is arithmetic the room depends on.** The lift is one control's
height, which is only exact while the control is the bottom-most thing in the
bar. The lobby's note therefore has a stated `line-height` (`$lobby-note-line`)
that the lift calculation reads, so the two cannot drift apart.
