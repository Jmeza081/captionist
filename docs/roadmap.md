# Build roadmap

Captionist is built **spine first**: domain model → pure reducer → swappable
transport → screens against real state → Ably last. Screens are never dummies
and never get refactored when the network lands.

> **Read this first after a context clear.** It is the answer to "where do we
> stand". Update the status column as phases land.

## Why this order

The alternatives both manage a risk this repo had already retired. *Scaffold
every screen first* buys design discovery — but `design/` already specifies all
16 screens, so screens built against invented props would just get refactored.
*One vertical slice at a time* avoids rework — but it forces the room protocol
to be re-decided once per screen, and front-loads the Ably plumbing onto the
first one.

Pages here are thin compositions of finished molecules, and every game-facing
molecule already takes primitives or `Pick<AvatarProps, …>` shapes rather than
domain objects. **The screens are the cheap part. The round state machine is
not.** So the state machine went first.

## Phases

| # | Build | Done when | Status |
| --- | --- | --- | --- |
| **0** | `lib/game/*` — types, rng, actions, reducer, authorize, selectors, project, fixtures. Vitest folded into `verify`. | A scripted 5-round game reaches `podium` with expected scores; a tie resolves to the seeded winner; a stale `clock/expired` is a no-op. | ✅ done |
| **1** | `lib/room/*` — `LocalTransport` (async), `HostEngine`, `GuestClient`, `BotDriver`, store, `RoomProvider`, `useRoom`. Host-death mitigations. | `/room/DEV?seed=42&bots=4` walks the whole flow as raw state JSON — no UI. | ✅ done |
| **2** | `RoomShell` chrome, `LobbyScreen`, `BriefScreen`, `ComposeScreen`, `/api/gifs` + Giphy search. | Play to `waiting` on a phone viewport; timer, rail offset and toolbox all real. | ✅ done |
| **3** | `WaitingScreen`, `VoteScreen`, `TiebreakScreen`, `RevealScreen`, `ScoreScreen`, `PodiumScreen`. | **A complete 5-round game, solo, vs 4 bots, both modes.** The milestone that matters. | ✅ done |
| **4** | ~~Landing~~, `/join`, `/join/[code]`, `/host`, real room codes, join + nickname + avatar, `BroadcastTransport`. | Two tabs, one host one guest, a real game with no network. | ✅ done |
| **5** | `AblyTransport`, `/api/ably/token`, presence, reconnect overlay. Plus the ADR and the client↔API-route↔Ably diagram. | Two devices on the same wifi. | ✅ built, gate unverified — see below |
| **6** | Chat + live reaction tallies on the event lane. | `ChatRail` fills; vote-card tallies go live. | ✅ done |
| **7** | The three phase-6 deferrals — GIF attachments in chat, the "replying to" quote block, the Slackmoji tiles and pack tabs — plus the two host settings no screen read. | Screens `2b`, `2c` and `3k` are reachable; a single-vote room pays one point and a one-line room asks for one caption. | ✅ done |

Nothing in phases 2–3 knows a transport exists beyond `useRoom()`, so **phase 5
changes exactly one line**: which implementation `RoomProvider` constructs.

**The landing page landed out of order**, pulled forward from phase 4 on
request. It cost phase 3 nothing, and phase 4 has since caught up with it: `/`
now routes "Start a game" through `/host` and "Join a room" to `/join`, which is
the flow the design draws.

**Phase 5 is still one line in `RoomProvider`** — which implementation it
connects. Phase 4 proved that by being the second one: nothing above
`useRoom()` changed to accommodate a guest in another tab. What did change is
recorded in [ADR 0007](./adr/0007-the-first-tab-to-ask-owns-the-room.md), and
the per-recipient channel decision there is the one phase 5 inherited.

**Phase 5's gate is the one no test can make.** Everything is built and covered:
`AblyTransport`, `/api/ably/token`, presence driving the held seat, and the
reconnect overlay. But "two devices on the same wifi" needs an `ABLY_API_KEY`
and a second device, and this machine has neither — so the suite runs on
`BroadcastTransport` (via `ABLY_STUB` / `?transport=broadcast`), which is the
same road every spec took in phase 4. **The Ably path itself is unexercised.**
Two things to check the first time it runs for real: `allowedDevOrigins` in
`next.config.mjs` is `['127.0.0.1']` and does not include the LAN address a
phone uses, and `NEXT_PUBLIC_APP_URL` must stay unset or the lobby's QR encodes
`localhost` and is a dead link on that phone.

**Phase 6 was mostly wiring, and that was the point.** `ChatMessage`,
`Composer`, `ReactionToolbar`, `ReactionFloaters`, `UnreadDivider` and
`TallyPill` were all built in phase 2 and rendered nowhere but the gallery;
`RoomEvent` was cut in phase 1 with both its kinds. So the phase added one
store (`lib/room/events.ts`, deliberately *beside* `RoomStore` — a message must
never bump the `rev` guests drop stale game updates against), the hooks over
it, and a phone treatment. Three things did change shape:

1. **The event lane trusted its sender.** `AblyTransport` stamped an intent's
   `from` from `message.clientId` and passed a `RoomEvent`'s straight through
   from the payload; `BroadcastTransport` checked a roster token on an intent
   and nothing on an event. Harmless while nothing published events, and "post
   as anyone in the room" the moment chat did. All three transports now stamp
   `from` on receive.
2. **The reaction event widened rather than forking.** `target: 'entry' |
   'message'` instead of a third kind, so a card reaction and a message
   reaction share one handler, one derivation and one rate limit.
3. **Chat is not gated by phase.** The design draws it live through the vote
   with a divider in the stream, and gating it would have broken the rail's
   always-docked contract for a problem the round does not have — somebody
   writing a caption is already not typing in chat.

Deferred at the time, and all three built in phase 7: **GIF attachments in
chat**, the **"replying to" quote block**, and the reaction picker's **four
Slackmoji tiles**.

**Phase 7 was three deferrals and two settings that lied.** The deferrals were
mostly reconnection: `Composer` had declared every attachment prop since phase
2, `ChatMessage` already drew a 180×120 attachment, `GifPanel` already had a
`popover` variant whose comment called it "the composer's attach-a-GIF
surface", and `ChatPanel` passed none of it. What was actually missing was the
wire — the `chat` event carried a bare string. Four things changed shape:

Both of the first two are recorded in
[ADR 0011](./adr/0011-a-quote-is-a-copy-and-a-glyph-is-a-location.md).

1. **The quote is a snapshot, not an `EntryId`.** `round.entries` is replaced
   wholesale when the round turns over and nothing in `history` keeps a
   caption's text, so an id would resolve to nothing by round three — exactly
   when the design's reason for the quote ("keeps the reply legible after the
   grid has scrolled") starts to matter. It carries content and never
   authorship, which would hand back what `project()` strips.
2. **The reaction lane was pointing every browser wherever a sender chose.**
   The wire carries a reaction's *glyph*, and once the picker had image tiles a
   glyph became a URL that twenty browsers fetch — a beacon needing no script.
   `lib/gifs/allow.ts` now gates the attachment, the quote thumbnail and the
   glyph against the same allowlist, and `ReactionGlyph` renders it so no
   tally prints a URL as text.
3. **The Slackmoji blocker was the uploader's, not this one's.** See
   [design-system.md §5](./design-system.md).
4. **The reply affordance is ours.** Screens 2c draws the message and never the
   control that produces it, so `MediaCard` gained a `reply` slot beside
   `reaction` — a fourth thing in a row the design draws with three.

**And the two settings.** `format:'one'` and `voting:'single'` were live
controls in `/host` that no screen read. `ComposeScreen` never referenced
`settings.format` at all; `VoteScreen` always cast `kind: 'rank'`, so a room
whose label promised one point paid `RANK_POINTS[0]` — three. `authorize` did
not compare a ballot's kind to the room's rule either, so the bug was reachable
from any client, not just that screen. Nothing covered either setting end to
end, which is why both survived four phases.

## Before launch

Not a phase — a gate. Do these when the room stops being a dev toy.

- [ ] **Swap the keys.** `GIPHY_API_KEY` and `ABLY_API_KEY` in `.env.local` are
      personal development credentials: the Giphy key spends a personal rate
      limit and the Ably key bills a personal account. Issue project-owned keys
      and set them as deployment environment variables, not a file in the repo.
- [ ] **Check `NEXT_PUBLIC_APP_URL`.** Unset is right in development; in
      production it must be the real origin, or the lobby's QR code encodes a
      link no phone can reach.
- [ ] **Clear `ABLY_STUB` and `GIFS_STUB`** in the deployed environment. The URL
      levers are already gated to non-production; these are not.
- [ ] **Widen `allowedDevOrigins`** only for LAN testing, never for the deployed
      build.

## Decisions already taken

| | Decision |
| --- | --- |
| Authority | The host browser is the server. Ably is pub/sub + presence. No database. |
| Role holder | **Does not compete.** Sets the round up, sits it out, then votes. |
| Uploads | **Blocked in v1** — no storage target exists. `Dropzone` says why. |
| GIFs | Real Giphy, proxied through a route handler so the key stays server-side. |
| Chat | Deferred to phase 6; it is a `RoomEvent`, never game state. |
| `format:'one'`, `voting:'single'` | Implemented in phase 7. Both were live controls in `/host` that no screen read — a single-vote room paid 3/2/1, and "One line" changed nothing but a summary label. |
| Help modal | Never pauses the room. Only the host's explicit pause stops the clock. |

Accepted cost of host authority: **if the host's tab dies, the room ends.**
Phase 1 mitigates (`sessionStorage` snapshot per `rev`, `beforeunload` →
`host/left`, `visibilitychange` → `catchUp()`), and the transport boundary keeps
a server-authoritative variant open later.

## Structural claims the model rests on

1. **`landing`, `join` and `setup` are routes, not phases** — no room exists
   during them.
2. **`pick`/`pickwait` and `prompt`/`promptwait` are one phase rendered four
   ways.** Phase is room-wide and authoritative; "is it my turn" is per-viewer
   and derived. Same for `caption`/`submit` → `compose`. This is what makes
   *never fork a shared screen* a type-level fact rather than a discipline.
3. **The round opener is a phase, not a boolean**, so its 3.8s dismiss is the
   same mechanism as every other timeout and "skip" is identical to expiry.

Fourteen designed states resolve to **10 room phases and 10 screen organisms**.
`BriefScreen` covers `1g/1v/1x/1w/1h/3a/3b`; `ComposeScreen` covers
`1i/1s/3c/3d`.

## The URL levers

Read once in `RoomProvider`, and **gated to non-production** so no test branch
can leak into a screen.

| Lever | Does |
| --- | --- |
| `?seed=42` | Fixes the PRNG, so the vote shuffle is reproducible and card selectors are stable. |
| `?bots=4` | Spawns bot guests *over the transport*, so one page plays a full room. |
| `?fast=10` | Scales the room's clock — a 5-round game in ~30s instead of ~5min. |
| `?phase=vote` | Boots from `lib/game/fixtures.ts` so a screen gets a spec without playing to it. Also **declares this tab the host**, so a harness room is never handed to a stale tab by the claim probe. |
| `?mode=react` | Boots that fixture in the reversed mode. Without it the react lane is unreachable, because every fixture takes `DEFAULT_SETTINGS.mode`. |
| `?voting=single`, `?format=one` | Boots that fixture under the other voting rule or caption format, for the same reason as `?mode=`. Without them the only road to a single-vote room is `/host` → `sessionStorage` → a room, which drags a route boundary into a screen spec. |
| `?as=p2` | Takes a different seat. Round one's role holder is always `p0`, and the role holder sits the round out — so the caption and answer faces cannot be reached as the host. It exercised the guest path a phase before real joining depended on it. |
| `?transport=broadcast` | Runs the room over `BroadcastChannel` instead of Ably — one browser, many tabs, no network and no key. What the whole test suite runs on; `ABLY_STUB=1` does the same thing stickily. |
| `?gifs=stub` | Serves offline sample art instead of calling Giphy. `GIFS_STUB=1` does the same thing permanently; a missing `GIPHY_API_KEY` falls back to it outside production. |

`?as=` needs `?phase=`: it takes a seat that already exists, and in a fresh room
the other seats are empty until somebody joins. Real joining is built now, so
this lever is for reviewing a *populated* screen without playing to it — to sit
in a second seat for real, open a second tab on the room's code.

`?fast` scales the host's clock rather than faking the page's: `page.clock` is
per-page, and with a host in one page and guests in others it would
desynchronise the room.

## A naming collision worth knowing

The `/feature` skill *also* has numbered phases (1 = research, 3 = design
artifact). **"Phase N" in conversation means this file's numbering.** Phases 0
and 1 have no visual surface, so `/feature`'s phases 1 and 3 were skipped there
under its escape hatch; from phase 2 on they apply.
