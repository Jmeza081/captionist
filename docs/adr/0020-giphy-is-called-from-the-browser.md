# 0020 — Giphy is called from the browser, and the key is public

**Status:** accepted · 2026-08-31 · one Context paragraph corrected, see below

## Context

The app called Giphy the way a careful backend engineer would: a route handler
at `/api/gifs` held the key server-side, and the fetch inside it carried
`next: { revalidate: 3600 }` so a search term cost one upstream call an hour no
matter how many players ran it. The response added `Cache-Control: s-maxage=3600`
on top. `docs/roadmap.md` recorded it as a settled decision — "proxied through a
route handler so the key stays server-side" — and `lib/gifs/giphy.ts` opened
with a comment saying the key "never reaches the browser".

Reading Giphy's API requirements before applying for a production key showed
that every one of those choices is prohibited:

> Do not proxy requests to GIPHY, either API calls or media URL loads. **All
> requests to GIPHY should be made directly from the client side.**

> Do not cache media URLs or copies of GIPHY media assets unless your
> integration has been explicitly approved by GIPHY for media caching and
> follows GIPHY's required cache revalidation implementation.

> Do not reorder, insert, remove, suppress, replace, or filter [search and
> trending results].

> [Do not] blend our media with content from another provider [in the same grid].

Attribution — "Powered By GIPHY", conspicuously, wherever the API is used — was
present on exactly one screen of three.

The obvious hedge was to move to a different provider. Tenor is gone: Google
stopped accepting new API clients in January 2026 and shut the API down on
30 June 2026. Klipy, where most of that traffic went, publishes integration
requirements that are near-identical to Giphy's on all four points above, so
switching would not buy back the architecture.

> **Correction, 2026-08-31.** The sentence above is wrong on the point that
> matters. Klipy issues two kinds of key: a *test* key allowing roughly 100
> calls an hour, which is what that comparison was measuring, and a *production*
> key that is free and advertised as unmetered, funded by ads served inline in
> the results rather than by a licence fee. Switching does not buy back the
> proxy or the cache — that part holds — but it does buy back the allowance,
> which is the premise every limit in [ADR 0021](./0021-the-rooms-limits-are-a-rate-limit.md)
> rests on. See [ADR 0022](./0022-the-gif-provider-is-a-seam.md).

The rule is not arbitrary. Giphy revokes URLs for content moderation, and a
cache without their revalidation pattern keeps serving media they have pulled.
For a game played at work that is a real risk, not a paperwork one.

## Decision

**Giphy is called directly from the browser, with a public key, and nothing
caches it.**

- `app/api/gifs/route.ts` is deleted. Its three-way stub switch — the sticky
  env var, the `?gifs=stub` lever, and "no key outside production" — moves to
  `lib/gifs/source.ts`, which is now the one place that decides which shelf a
  board comes from.
- `next: { revalidate }` and the `s-maxage` header are gone. Every board is a
  live request.
- `GIPHY_API_KEY` becomes `NEXT_PUBLIC_GIPHY_API_KEY`. This is Giphy's own
  model: they instruct you to issue a separate key per platform precisely
  because it ships to clients. The key is rate-limited, not secret.
- The attribution mark moves **into `GifPanel`**, so it is a property of the
  component that draws their content rather than something each screen has to
  remember. It renders only when `source === 'giphy'` — claiming Giphy over the
  offline shelf would be a different kind of wrong.
- `wallTiles()` stops calling Giphy entirely and draws the landing wall from the
  committed shelf. It was a server-side call (a proxy), it blended Giphy results
  with samples to fill a short answer (a mix), and it was only ever affordable
  because of the hour-long cache. Without that cache it would have been one call
  per visitor on the four highest-traffic routes in the app.
- `searchGiphy` keeps Giphy's order and drops only an item with no `id` or no
  usable image URL — a tile that cannot be drawn, not a filter on content. The
  reason is now written at the call site.

## Consequences

**The key is readable by anyone who loads the page.** That is the accepted
cost, and it is worth stating plainly rather than discovering later: someone can
lift it from the bundle and spend the hourly allowance. Mitigated by using a
web-only key and rotating it if abused. `.env.example` says so where it will be
read.

**Losing the cache is what forced every limit in
[ADR 0021](./0021-the-rooms-limits-are-a-rate-limit.md).** The proxy made a
board free after the first player fetched it; now each player pays for their
own. The room cap, the round cap, the board size and the search budget all exist
because of this decision, and they are the reason it is survivable.

**The picker's first paint is slower.** Repeat trending loads were instant off
the Data Cache and are now a round-trip. The 4s timeout in `searchGiphy` bounds
the worst case.

**The e2e suite's stub switch had to be renamed in `playwright.config.ts`.**
`GIFS_STUB` would be read by nothing and fail open — a full-suite run would have
started reaching for a live third party, which is exactly what that env block
exists to prevent. It is `NEXT_PUBLIC_GIFS_STUB` now, and `notFound.ts` reads
the same name.

**`e2e/gifs.spec.ts` was rewritten.** It tested the route through `request`;
there is no route. The same guarantees are asserted through the browser, which
is also where the call-counting test in ADR 0021 had to live anyway.

**This does not make the beta key sufficient.** It makes the app legal to run
on one. Whether a production key is worth buying is a separate, open question —
Giphy prices it privately and will not quote without an application.
