# 0011 — A quote is a copy, and a glyph is a location

**Status:** accepted · 2026-08-28

## Context

[ADR 0010](./0010-chat-is-a-second-store-and-its-sender-is-stamped.md) settled
*who* a message is from: the transport stamps `from` from the identity it
authenticated, on every implementation. Phase 7 widened the same lane to carry
what the design has drawn since the start — a GIF attached to a message
(Screens `3k`), and the caption a message is answering (`REPLYING TO`, on nine
screens). That raised two questions the text-only lane never had to answer.

**What does a quote point at?** The obvious shape is the entry's id. It is
small, it is already the ballot's currency, and it looks like a foreign key.

It is also wrong twice. `round.entries` is replaced wholesale when the round
turns over, and nothing in `history` keeps a caption's text or its media — only
`ranking`, `points` and `authorOf`. Chat scrollback is fifty messages and
outlives the round by design. So an id resolves to nothing by round three,
which is precisely when the design's stated reason for the quote — *"keeps the
reply legible after the grid has scrolled"* — starts to matter. And resolving
one at render would make the event store read `PublicState`, which is the
coupling `EventStoreOptions.isMember` is a predicate rather than a roster to
avoid: a thing that was *said* would change what it says because the room moved
on.

**What may a message point at?** The lane now carries sender-supplied URLs, and
every member's browser renders them in an `<img>`. That is a different
question from ADR 0010's. Stamping `from` settles who spoke; it says nothing
about where their words point. One player picking a reaction would make twenty
browsers fetch a host of that player's choosing — a beacon, needing no script
to work.

The reaction lane is the sharp edge, and it was not obvious. The wire carries a
reaction's *glyph* rather than its id, because a tally has to render something
and an unknown id renders as nothing. That was harmless while every glyph was
an emoji. The moment the picker gained image tiles, a glyph became a URL, and
`receiveReaction` validated neither its scheme, its origin, nor its length.

## Decision

**A quote is a denormalised snapshot: `{ src?, caption }`.** No `EntryId`, and
the omission is deliberate rather than an oversight — an id that nothing
resolves is a trap for whoever helpfully resolves it. If a jump-to-the-card
affordance is ever wanted, it can be added then, with its own reason.

**A quote never carries authorship.** Not an id, not a name, not a face.
`project()` strips `authorId` while voting is open, and a "replying to Jesska's
caption" label would hand it back by a second route — the same failure
`redactTiebreak` already exists to prevent. Content is safe to copy because
every voter can already see it; authorship is not.

**One allowlist gates every image the lane carries.** `lib/gifs/allow.ts`
accepts same-origin `/media/*.svg` — the app's own art — and `https://` URLs
whose hostname is or ends with `giphy.com`, parsed with `URL` so a lookalike
host fails on hostname rather than passing on a prefix. Everything else is
refused: `data:`, `blob:`, plain `http:`, and every third-party origin. It
lives in `lib/gifs/` because it is a fact about where this app's images come
from, not about how a room talks. It gates the attachment, the quote's
thumbnail, and the reaction glyph alike.

**A bad source degrades the message rather than refusing it.** A disallowed
attachment is dropped and the words survive; a disallowed thumbnail is dropped
and the quoted caption survives. Only when nothing is left does the message go.
That matches the lane's existing policy for length — truncate, don't refuse.

**A GIF alone is a complete message; a quote alone is not.** `receiveChat`
drops an event with neither text nor attachment. `Composer.canSend` says the
same thing on the way out, and the two have to agree — otherwise a player
watches a message leave and never arrive.

## Consequences

Chat scrollback now retains up to fifty remote images rather than fifty
strings. `ChatMessage`'s attachment is `loading="lazy" decoding="async"`, and
this is a real change in what the log costs; it is worth measuring before the
history cap is ever raised.

A sender can quote a caption nobody wrote, because the quote is a copy they
supplied. That is not a new hole — chat is already sender-authored free text,
and someone can type the same lie. `from` remains the boundary that matters.

Adding a second image source later means one edit in one file, and the tests in
`lib/gifs/allow.test.ts` are the specification of what is allowed.

The allowlist is enforced on **receive**, like every other guard in the store,
so it holds on every transport — including the ones where a sender's identity
is asserted rather than issued.
