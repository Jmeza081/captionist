# 0022 — The GIF provider is a seam, and the room stops naming a vendor

**Status:** accepted · 2026-08-31

## Context

[ADR 0020](./0020-giphy-is-called-from-the-browser.md) settled how Giphy is
called: from the browser, with a public key, and nothing caching it, because
their terms forbid a proxy and a cache. That decision is unchanged and this ADR
does not touch it.

What it also said, in one sentence of Context, was:

> Klipy, where most of that traffic went, publishes integration requirements
> that are near-identical to Giphy's on all four points above, so switching
> would not buy back the architecture.

**That sentence is wrong, and it is wrong in the direction that matters.** Klipy
issues two kinds of key. A *test* key allows roughly 100 calls an hour — the
same shape as Giphy's beta allowance, and the number
[ADR 0021](./0021-the-rooms-limits-are-a-rate-limit.md) sized the entire room
against. A *production* key is free and advertised as unmetered, funded by ads
served inline in the results stream rather than by a licence fee.

So the constraint that produced `MAX_PLAYERS = 10`, `ROUNDS_MAX = 5`,
`SEARCHES_PER_ROUND = 3` and a chat with no GIF replies is not a fact about
GIFs. It is a fact about one vendor's free tier. That is not a thing worth
hard-coding into a component, an error class, a copy string, a host allowlist
and a persisted room setting — which is where it had got to:

- `GiphyError` and `GiphyRateLimitError` were imported by name into
  `useGifSearch`, a hook that otherwise knows nothing about who supplies tiles.
- `GifPanel` hardcoded `'Search Giphy…'`, `'Powered by Giphy · SFW filter on'`
  and `'via Giphy'`, each gated on a `source === 'giphy'` string comparison.
- `allow.ts` hardcoded `isGiphyHost`.
- `RoomSettings.giphyEnabled` put a vendor's name in the domain model — and
  turned out to be a control that nothing read.
- `GifSearchResponse.source` was the literal union `'giphy' | 'sample'`.

## Decision

**The picker depends on a provider contract, not on Giphy.**

- `lib/gifs/provider.ts` declares `GifProvider`, `GifProviderDescriptor`,
  `GifQuery`, `GifBoard` and `GifCursor`. Types only.
- `lib/gifs/descriptors.ts` holds the providers as **data**, with no HTTP client
  anywhere behind it — `allow.ts` reads the media hosts from there and is called
  by `lib/room/events.ts` on every inbound event, so that edge must not drag a
  `fetch` client into the bundle with it.
- `lib/gifs/errors.ts` replaces the vendor-named errors with `GifProviderError`
  and `GifQuotaError`. The vendor rides on the instance as `provider`, so a
  message can name it without a caller having to import it.
- `giphy.ts` becomes one adapter among others. **Nothing about how Giphy is
  called changed** — ADR 0020's terms did not.
- `lib/gifs/registry.ts` selects a provider from the environment, and
  `source.ts` resolves the shelf as before.
- `GifPanel`'s `source?: 'giphy' | 'sample'` prop becomes
  `provider?: GifProviderDescriptor`. This is the load-bearing part of the
  refactor and not merely a rename: "never credit anyone over the offline shelf"
  stops being a string comparison somebody has to remember and becomes
  structural — there is no mark to render because there is nobody to credit.
- The `?gifs=` lever widens from `stub | live` to `stub | live | giphy | klipy`,
  so both adapters can be exercised in one browser without a rebuild. Naming a
  provider implies `live`; you cannot pin the shelf to a provider, because the
  shelf is nobody's.

### The cursor is opaque

Giphy counts items (`offset`); Klipy counts pages (`page`, 1-based). `GifCursor`
counts pages and each adapter does its own arithmetic, because the adapter is
the only thing that knows which model it is in. It carries the provider that
minted it, so a cursor can never be spent against a stranger.

Nothing pages today — ADR 0021 deleted "Shuffle results" — but `useGifSearch`
still threads the position through, and this is the shape it will want back.

### `NEXT_PUBLIC_*` is read by literal name, inside a function

Next inlines `NEXT_PUBLIC_*` at build time **by name**, so `process.env[id]`
comes back `undefined` in the browser. It works perfectly in vitest, which runs
in Node — which is exactly how that mistake reaches production unnoticed. So the
registry's reads are written out in full.

They are also written *inside a function* rather than at module scope. Inlining
does not care where the literal appears; a frozen module-scope constant would,
because it would make the environment unmockable and every test that set a key
after importing the registry would silently assert against whatever the process
held at import time.

`source.test.ts` guards both halves with a source read, comments stripped —
there is no behaviour here that Node can be made to get wrong, so a behavioural
test cannot catch it.

## Consequences

**ADR 0020 is amended, not superseded.** Its decision survives intact: Klipy is
called the same way, from the browser, for the same reasons. Only the Context
paragraph quoted above is wrong, and it now carries a correction.

**ADR 0021's numbers have not moved.** Its arithmetic is Giphy's 100/hour and a
production Klipy key removes the premise, but removing a premise is not the same
as taking a decision. The caps stay until they are changed deliberately, with
measurements — superseding that ADR now would leave the repo documenting limits
it still enforces.

**A false attribution disappeared.** `ComponentGallery` rendered `GifPanel`
without a `source` prop, so it took the `'giphy'` default and printed "via
Giphy" over local placeholder art. Defaulting to `undefined` fixes it, and the
new shape makes that class of mistake unavailable rather than merely fixed.

**Attribution moved one step further out than ADR 0020 put it.** That ADR moved
the mark into `GifPanel` so each screen could not forget it. The strings now
live on the descriptor, so the *component* cannot claim the wrong provider
either.

**The board's placeholder is still an example query.** `deploy on friday`
teaches what to type in a way "Search X" does not, and it is deliberately not on
the descriptor yet. A provider that mandates its own placeholder wording would
take that away — a design question, not something to settle by widening a type.

**Klipy is the default, on a test key.** Their test key allows 100 calls an
hour — exactly the allowance the Giphy beta key it replaces gives — so the flip
costs nothing to try and is one line in `PREFERENCE` to undo. It was sequenced
ahead of the production key deliberately: `usage.ts` exists to produce evidence
for a Klipy application, and while Giphy answered the boards it was diligently
measuring the wrong provider.

**Ads are in the contract and not yet modelled.** Every sampled item came back
`type: "gif"`; no key here has been served an ad, while the response's own
`meta.ad_max_resize_percent: 10` proves they exist. Anything that is not a GIF
is dropped — the same rule Giphy's client follows for an undrawable tile. That
number is also a design constraint worth knowing before the work starts: an ad
may be resized by at most 10%, so it cannot flex into a masonry column the way a
GIF can. Turning ads on in the Partner Panel is the prerequisite for building
this, not the other way round.

**The "let the picked player search" toggle is gone, and the design has it.**
`design/Captionist Screens.dc.html` draws it on the host setup screen, so this
is a deliberate divergence from the source of truth rather than an oversight —
recorded here because `CLAUDE.md` says that when code and design disagree, the
code is the bug, and this is the exception that proves it was considered.

Two reasons. It was **inert**: `RoomSettings.giphyEnabled` was written by that
`Toggle` and read by no selector, reducer or screen. And it is a control for a
state the game cannot be played in — every round of `caption` needs a GIF to
caption and every round of `react` needs a GIF as an answer, so a room with GIF
search off is not a degraded room, it is not a room. Shipping a switch that
promises to turn off the thing the game is made of would be a worse lie than
omitting it.

What it was reaching for is real and is answered elsewhere: a host who wants to
keep a session off the allowance has `NEXT_PUBLIC_GIFS_STUB` and `?gifs=stub`,
which serve the offline shelf — a board that still works rather than a picker
that is switched off.

**The app still credits Giphy in three places, on purpose.** The waiting
backdrop, the 404 GIF and the landing wall are hot-linked `media.giphy.com`
URLs, not API calls: they cost no allowance and break no terms while their
credits stay where they render. Giphy's "do not blend our media with another
provider" is about a *grid* — the wall is all Giphy, the picker is all Klipy,
and they are different surfaces. Re-curating them is taste work, not
engineering, and would be its own change.
