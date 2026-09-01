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

**Half of that sentence is right, and it is the half that does not matter.**
Read against Klipy's published integration requirements, the comparison holds
exactly: they also forbid proxying the API, caching or re-hosting the media,
reordering or filtering results, and blending their content with another
provider's in one grid — each without prior written approval. Switching buys
back none of the architecture ADR-0020 gave up.

**What it buys is the allowance, and that is the part that was missed.** Klipy
issues two kinds of key. A *test* key allows 100 calls an hour — the same shape
as Giphy's beta allowance, and the number
[ADR 0021](./0021-the-rooms-limits-are-a-rate-limit.md) sized the entire room
against. A *production* key is free and unmetered, funded by ads served inline
in the results rather than by a licence fee. So the conclusion — "switching
would not buy back the architecture" — is true and was the wrong test.

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

> **Correction, 2026-09-01.** They have moved. The production key was approved
> and [ADR 0026](./0026-the-rooms-limits-are-a-design-choice.md) supersedes
> ADR 0021. One clause above did not survive contact: the caps did *not* need
> measurements to change, because each was a quotient with the allowance in its
> denominator and removing the denominator leaves no division to do. What the
> measurements were actually for — and what `usage.ts` delivered — was the
> production-key application itself.

**A false attribution disappeared.** `ComponentGallery` rendered `GifPanel`
without a `source` prop, so it took the `'giphy'` default and printed "via
Giphy" over local placeholder art. Defaulting to `undefined` fixes it, and the
new shape makes that class of mistake unavailable rather than merely fixed.

**Attribution is complete, and smaller than assumed.** Klipy's guidelines make
exactly one item required — `Search KLIPY` as the search field's placeholder —
and mark both the watermark on shared content and the "Powered by KLIPY" mark
optional. A third-party library's README describes the watermark as strongly
recommended; Klipy does not. So the required item ships, one of the two optional
ones ships as well, and `MediaCard` needs nothing.

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

**Ads are not modelled, and the adapter currently drops them — which their
terms do not allow.** Requirement 4 is "do not independently reorder, insert,
remove, suppress, replace, or filter returned results", and any approved
filtering "must be configured through the KLIPY Partner Panel". Dropping
`type !== 'gif'` is a client-side filter. It is inert today for a reason worth
writing down rather than relying on: **ads are only delivered if you ask for
them.** They require `customer_id` and the four `ad-min/max-width/height`
parameters, and this adapter sends none, so no ad has ever reached the filter.
Sending those parameters and rendering what comes back has to land together.

**An ad is not an image.** Asked for properly, the test key returns objects with
no `slug` and no `file` — `{ type, width, height, content }`, where `content` is
a complete HTML document carrying its own stylesheet, its own click-through
`<a target="_blank">`, its own "AD" badge and a script. Klipy's guidance is to
render it in a WebView on mobile; on the web the equivalent is a sandboxed
iframe with `srcdoc`, because injecting a third party's document into our own
origin would hand it our DOM and storage, and its `html.klipy-ad body` rules
would escape into the page. Observed sizes were 250×250 and 300×100 against a
`$gif-board-min` column of 240px, and `meta.ad_max_resize_percent: 10` caps
rescaling at ten percent — so an ad cannot be made to fit a masonry column the
way a GIF can, and needs its own placement rather than a tile variant.

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
