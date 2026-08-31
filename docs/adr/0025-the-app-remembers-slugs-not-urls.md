# 0025 — The app's own art is remembered by name, not by URL

**Status:** accepted · 2026-08-31

## Context

Three surfaces want *particular* GIFs rather than whatever is trending: the
landing wall on four routes, the waiting backdrop, and the 404.

[ADR 0020](./0020-giphy-is-called-from-the-browser.md) settled how: a build
script — `scripts/import-wall-gifs.mjs` — searched Giphy, and twenty
`media.giphy.com` URLs were committed to `lib/gifs/wall.catalog.ts`. The
backdrop and the 404 were single hand-picked URLs written into the source. No
key, no network, no quota, and the wall arrived complete in the first HTML.

Reading Klipy's integration requirements — reachable for the first time on
2026-08-31, see [ADR 0022](./0022-the-gif-provider-is-a-seam.md) — that
arrangement is wrong twice over:

> API requests and media loads must originate from the user's mobile app,
> desktop app, or web browser. Do not route requests through partner-operated
> servers, proxies, CDNs, or other intermediaries without prior written
> approval from KLIPY.

> Do not store, mirror, re-host, rewrite, or retain copies of KLIPY media
> unless KLIPY has approved a different delivery method in writing.

A build-time importer is a server-side request. A committed URL is retained
delivery data — and their guidance names "server-side requests, proxying, media
caching" as things to seek prior approval for.

There is a reason underneath the paperwork. A committed URL keeps serving
content after the provider has pulled it. That is the same moderation risk
ADR 0020 cited for caching, and for a game played at work it is a real one.

## Decision

**What is committed is slugs. The media is resolved in the browser, on every
page load.**

- `lib/gifs/art.ts` holds `WALL_SLUGS`, `BACKDROP_SLUG` and `NOT_FOUND_SLUG` —
  twenty-two content identifiers and no URLs at all.
- `GifProvider` gains an optional `items(slugs, apiKey)`. Klipy implements it
  against `gifs/items`; Giphy does not, so a Giphy build falls through to the
  app's own art rather than half-working.
- `wall.catalog.ts` and `scripts/import-wall-gifs.mjs` are deleted.
- The server renders the app's own SVG shelf, always. `HeroWall`,
  `BriefScreen` and the 404 upgrade themselves after mount via `useArt.ts`.

**A slug is a name; a URL is delivery data with tracking in it.** Remembering
the first is how the app keeps its art direction — somebody chose these
twenty-two GIFs — without keeping the second. Asking again on every load is
also what lets a moderation decision reach these surfaces, instead of being
frozen into the repository until someone regenerates a catalog.

### The fallback is the design, not the error path

Every one of these surfaces renders the app's own art first and keeps it if
nothing resolves — no key, no network, a spent allowance, an outage, or the
`NEXT_PUBLIC_GIFS_STUB` / `?gifs=stub` switch. Nothing throws and nothing shows
a spinner. A landing page that renders house SVGs is fine; a landing page that
renders a stack trace is not.

`resolveArt` honours the stub switch for the same reason `fetchBoard` does: that
flag is documented to keep *every* surface off a third party, and the Playwright
suite depends on it — it resolves no host but the dev server, so a wall that
called out anyway would draw twenty broken tiles.

### One lookup per page load

`resolveArt` memoises in memory, keyed by the slug list. Not a cache in the
sense the terms forbid — nothing is persisted, nothing survives the page. It is
the ordinary lifetime of a fetch, and it matters because the waiting screen
mounts on every round and would otherwise resolve the same backdrop each time.

## Consequences

**The wall is no longer in the first HTML.** It arrives as the app's own art and
improves a beat later. On the four front-door routes that is a visible change,
and the honest trade for not making a server fetch what only a browser may.

**These surfaces now cost API calls** — one per slug-set per page load, counted
in `usage.ts` under a new `items` kind so they can be read apart from anything a
player did. `e2e/gifs.spec.ts` counts boards and art lookups separately, so
ADR 0021's search-budget guard keeps measuring the budget rather than drifting
every time a decoration moves.

Under a Klipy production key — free and unmetered — that cost is nothing. Under
the 100/hour test key it is real, which is another reason the stub switch had to
cover these surfaces too.

**The backdrop lost its uploader credit.** Giphy published one — "Backdrop by
Young Thug" — and Klipy publishes a title, not an author. The credit names the
work and the provider instead, and is no longer a link.

**Giphy is out of the app's own art.** It remains a working picker adapter and
stays in `allow.ts`, because a `MediaRef` picked before the swap is persisted
game state that must still render.
