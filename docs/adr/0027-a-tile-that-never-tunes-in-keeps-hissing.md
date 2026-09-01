# 0027 — A tile that never tunes in keeps hissing

**Status:** accepted · 2026-09-01

## Context

`TvStatic` shipped as *the* placeholder for media still being fetched. Until
now it stood in exactly two places: the landing wall's twenty cells, and the
waiting backdrop's one. Every other surface in the app that waits on a remote
GIF drew nothing.

The two that matter are the ones the game is played through. `GifPanel`'s
`board` variant draws fifty tiles on the `pick` phase and again on `submit`;
`MediaCard` draws up to nineteen on the vote grid, then the reveal, then the
compose preview. Each of them reserved its image's real aspect ratio — so the
grid never reflowed — and then left the reserved area transparent behind a 1px
hairline until the bytes landed. With `loading="lazy"` on fifty tiles, scrolling
the board was scrolling through holes.

`TunedImage` closes that. What needed deciding was not *whether* to draw a set
behind a tile, but what a set should do when the picture never comes — because
`SceneBackdrop` had already answered the same question, and answered it the
other way:

> `tuning` and no clip is static; settled and no clip is nothing at all. The
> difference matters because a lookup that failed will not un-fail, and a dead
> channel hissing behind the words forever is a distraction rather than a
> flourish.

Taken as a general rule, that says a tile whose GIF 404s should stop showing
static. Applied to a tile, it puts the hole straight back.

## Decision

**A backdrop settles to nothing. A tile settles to a dead channel.**

`TunedImage` drops its static on `load` and never on `error`. There is no error
handling to write: a pulled GIF or an unreachable CDN simply never fires
`onLoad`, and the set stays.

The rule underneath both is the same, and it is about what the surface is:

- A **backdrop** is behind a sentence. It is optional by construction — the
  screen was legible before any media resolved and is legible after. Something
  that failed should get out of the way of the words.
- A **tile** is the content. There is no version of a vote grid or a picker
  board with one cell removed: the layout has reserved that space, the
  provider's terms forbid filtering the result out, and the only alternative to
  a set is the empty rectangle this component exists to replace.

Two consequences follow that are worth stating, because both are the kind of
thing a later reader would try to simplify away:

**The static is unmounted, not covered.** Leaving it painting underneath a
loaded image would be one line shorter and wrong twice: `MediaCard` draws an
unselected image at `opacity: .85`, so it would be visible through every card on
a vote grid — and a field that repaints five times every 200ms under fifty
loaded GIFs is a bill for a picture nobody can see. Measured on the other side
too: fifty tiles all tuning holds a flat 60fps (median frame 16.7ms, worst
16.8ms of 182, indistinguishable from one tile), so the cost is in keeping them
after they are pointless, not in having them.

**`onLoad` alone is a race, and it loses it often.** A cached GIF, a `data:`
URI, anything that decodes inside the server HTML has already finished before
hydration attaches the handler. The event never arrives, and the static sits on
top of a perfectly good picture forever — a failure that looks exactly like the
component working. `TunedImage` checks `complete && naturalWidth > 0` on mount
for that, and `naturalWidth` is the half that keeps the error case honest: a
broken image is `complete` too, and reports zero.

**And it wears the same veil as every other set.** `$scrim-static` — the weight
`HeroWall` and `SceneBackdrop` already use, flat rather than blurred for the
reason that token exists. Raw, fifty tiles of noise is the loudest thing on the
page, and on a vote card it is drawn behind a caption somebody has to read.

## Amended, 2026-09-01 — the rest of them

The first pass covered the picker board and `MediaCard`. Five remote pictures
were left drawing the same blank box, and all five now take the same treatment:
the composer's staged attachment and its "Replying to" thumb, a sent message's
attachment and *its* quote thumb, and the vote screen's own subject thumbnail —
which is not a `MediaCard`, because it is a picture of the thing being voted on
rather than an entry. The chat *picker* stays plain, on the grounds already
given.

Nothing above changes. What the fixed-size shape did change is the wrapper: it
**declares no width** now. A block box with `width: auto` fills a block
container, so the fluid call sites are untouched while a 30px quote, a 52×40
staged tile and an 88px subject shrink-wrap to the size their image already
carries.

And it turned up a bug older than any of this. **A broken image is an inline
non-replaced box, and CSS width and height do not apply to one** — so a pulled
GIF collapsed the vote screen's 88px square to a strip of spilled alt text, and
had done since that thumbnail was written. `display: block` on the three fixed
thumbs fixes it, and is also what gives the set a box to paint in. Two smaller
consequences of the same fact: the alt text is `color: transparent` while a set
is up, so a dead channel is not captioned in white (the attribute stays on the
element, so assistive technology is unaffected), and `ChatMessage`'s attachment
— the one image in the app that deliberately reserves nothing, `width: auto` so
a 64px Slackmoji is never letterboxed into a 180px banner — stands in with the
design's attachment size off `[data-tuning]` until its picture arrives.

## Consequences

- A GIF that is pulled between the search and the render shows a dead channel
  rather than an empty box, indefinitely. That is intended, and it is the one
  place a static field is not a promise that something is coming.
- `MediaCard`'s existing `missing` check — an entry that carries no media at
  all — passes `tuning={false}` and keeps drawing its alt text. A *settled
  nothing* and a *wait* still do not look the same; that is `SceneBackdrop`'s
  rule, and this is where it survives.
- `MediaCard` stays a server component. The `'use client'` boundary is the leaf,
  which is one boolean and a ref.
- The chat composer's `popover` is excluded by `tuning={board}` rather than by a
  second tile. Twelve flickering thumbnails over a live chat rail is a different
  amount of noise; flipping that prop is the whole change if it should have it.
- Three neighbouring gaps stay open and are named in
  [`docs/roadmap.md`](../roadmap.md): the cold board before any result has
  landed, a re-search holding the previous board with no signal, and the
  popover.
