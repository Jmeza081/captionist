# 0012 — The catalog is licensed art, and the animation is borrowed

**Status:** accepted · 2026-08-28

## Context

The room shipped 32 reactions. For a game whose whole event lane is reactions
that is thin, and the ask was direct: import the catalog from
[slackmojis.com](https://slackmojis.com), which is where the custom emoji a
team actually uses come from.

We cannot, on two independent grounds.

**Their terms forbid it.** Not by implication — by name. The prohibited
activities list includes *"Systematically retrieve data or other content from
the Services to create or compile, directly or indirectly, a collection,
compilation, database, or directory without written permission from us"*, and
the IP section bars content being *"copied, reproduced, aggregated,
republished, uploaded, posted, publicly displayed, encoded, translated,
transmitted, distributed, sold, licensed, or otherwise exploited for any
commercial purpose whatsoever."* Hotlinking `emojis.slackmojis.com` is the same
act with their bandwidth attached.

**They could not license it to us anyway.** The site describes itself as *"an
unofficial directory."* Its largest categories are Pokémon, Mario, Star Wars,
SpongeBob, the NFL and Sanrio. Whatever permission they gave would not be
theirs to give.

So the goal survives and the source changes.

## Decision

**The catalog is Google's Noto Animated Emoji, under CC BY 4.0.** 584 of them,
imported by `scripts/import-noto-emoji.mjs` and committed as still SVGs under
`public/media/emoji/`. Attribution — the licence's only requirement — is on
`/components` and in `public/media/emoji/LICENSE.txt`.

**The stills are ours to serve; the animation is not.** Google publishes these
at 512px and nothing smaller: `512.webp` is ~369KB and every animation runs 33
to 59 frames, so a local animated copy of the catalog is ~57MB and a downscaled
one is not much better. The still SVG averages 4.7KB, so the whole catalog is
~2.7MB committed. `ReactionGlyph` renders that still, then reaches for
`fonts.gstatic.com` for the animation only when the tile is near the viewport,
the browser has not asked for less motion, and the file actually decodes.

That CDN answers with `access-control-allow-origin: *` and a 48h/7d cache
policy, and the art on it is the art we are licensed to use. This is the
intended way to consume it, which is exactly what makes it different from the
option above.

**The animated URL never touches the wire.** The lane carries the same-origin
still, as it always has, and each browser derives the animation from it locally
via `lib/noto.ts`.

## Consequences

**[ADR 0011](./0011-a-quote-is-a-copy-and-a-glyph-is-a-location.md)'s allowlist
did not have to trust a new host.** It gained one optional path segment —
`/media/(emoji/)?…\.svg` — and nothing else. Had the catalog been hotlinked
instead, `isAllowedImageSrc` would have had to accept `fonts.gstatic.com` from
any sender, and the answer to "what may a message point at" would have grown a
third party. `lib/gifs/allow.test.ts` asserts that gstatic is still refused, so
the day that changes it will be on purpose.

**[ADR 0005](./0005-media-that-can-move-ships-a-still.md) is satisfied by
construction rather than by discipline.** The still is not a companion file
somebody has to remember to draw; it is the thing on the wire, and the
animation is the departure from it.

**The room still works with Google unreachable** — offline, on a blocked
network, in the stub shelf, and in Playwright, which now resolves no host but
the dev server so that this is tested rather than assumed.

**The picker had to learn to page.** A pack used to render whole, which was
right at fourteen tiles and is a stall at 238. `ReactionToolbar` renders 60 and
extends on scroll.

**This is not meme emoji.** Noto is the Unicode set, animated. The custom
character still comes from the four authored Slackmojis. If real slackmoji-style
art matters later, the honest route is host-supplied URLs — which puts the
licensing burden where Slack itself puts it, on the workspace that uploaded it.
