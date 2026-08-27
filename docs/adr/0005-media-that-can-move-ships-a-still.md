# 0005 — Media that can move ships a still

**Status:** accepted · 2026-08-27

## Context

The landing page's hero is a wall of twenty looping GIFs. The design calls it
the product demo, so it is real media rather than a gradient — which makes it
the heaviest thing in the app by an order of magnitude, sitting behind the
first screen anyone ever sees.

Three constraints collide there:

1. **A GIF is the wrong container for twenty of anything.** GIFs decode on the
   main thread, and the format's compression is thirty years old — the MP4 of
   the same clip is roughly a tenth of the bytes.
2. **A background must not cost the page its LCP.** A full-viewport background
   is not an LCP candidate, so the headline in front of it is what the metric
   measures — but only if the headline is text over a scrim rather than copy
   waiting on an image.
3. **Motion is not always wanted.** `prefers-reduced-motion` is a real
   preference, and honouring it is not "start, then stop".

The third constraint is the one with teeth, because the obvious implementations
do not work. CSS cannot reach inside an animated image to pause it. An SVG used
as an image does not reliably inherit the host page's `prefers-reduced-motion`,
so a media query inside the asset is not a guarantee. And `autoplay` on a video
starts before any preference has been read.

We found this the honest way: the first implementation guarded only `<video>`,
and the test caught the wall still animating under reduced motion.

## Decision

**Every piece of media that can move ships a still frame alongside it, and the
still is what the server sends.**

- `GifResult` carries `still` and `mp4` beside `src`. Giphy provides all three;
  the offline sample shelf ships a `-still.svg` next to each animated tile.
- The wall is resolved on the server (`lib/gifs/wall.ts`) and arrives complete
  in the first HTML at its final size. No client fetch, no waterfall, nothing
  to shift.
- Playback starts **off**. A client island reads the motion query and turns it
  on — so a visitor who asked for stillness never sees a frame, rather than
  seeing one and then having it stop.
- Stopping is a **source swap**, not a CSS rule, because that is the only
  mechanism that actually works for an animated image.
- Everyone gets a visible pause control. Wanting the background to stop is not
  the same as having configured an operating system to say so.

## Consequences

**Twice the assets for anything animated.** Twelve sample tiles became
twenty-four files. That is the price of stillness being a real state rather
than an aspiration, and they are ~1KB each.

**The wall costs one upstream call an hour, shared.** Resolving it on the
server means the cache is the fetch cache, not per-visitor. With no
`GIPHY_API_KEY` it falls back to the shelf, so the page renders identically
with no network and CI never depends on a third party.

**Motion is a progressive enhancement.** The page is complete and correct
before any script runs; hydration only ever adds movement. That is also why the
markup is server-rendered despite `HeroWall` being a client component.

**A rule for everything after this.** The room's own screens show one animation
at a time in a grid someone is reading, so they keep using the GIF — this is
not a ban on GIFs. It is a rule about *quantity* and about *consent*: past a
handful, prefer video; and anywhere media moves, stillness has to be reachable.
