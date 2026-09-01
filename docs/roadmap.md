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
| **2** | `RoomShell` chrome, `LobbyScreen`, `BriefScreen`, `ComposeScreen`, GIF search. (Built as `/api/gifs` + Giphy; the route is gone and the provider is a seam — ADR 0020, ADR 0022.) | Play to `waiting` on a phone viewport; timer, rail offset and toolbox all real. | ✅ done |
| **3** | `WaitingScreen`, `VoteScreen`, `TiebreakScreen`, `RevealScreen`, `ScoreScreen`, `PodiumScreen`. | **A complete 5-round game, solo, vs 4 bots, both modes.** The milestone that matters. | ✅ done |
| **4** | ~~Landing~~, `/join`, `/join/[code]`, `/host`, real room codes, join + nickname + avatar, `BroadcastTransport`. | Two tabs, one host one guest, a real game with no network. | ✅ done |
| **5** | `AblyTransport`, `/api/ably/token`, presence, reconnect overlay. Plus the ADR and the client↔API-route↔Ably diagram. | Two devices on the same wifi. | ✅ built, gate unverified — see below |
| **6** | Chat + live reaction tallies on the event lane. | `ChatRail` fills; vote-card tallies go live. | ✅ done |
| **7** | The three phase-6 deferrals — GIF attachments in chat, the "replying to" quote block, the Slackmoji tiles and pack tabs — plus the two host settings no screen read. | Screens `2b`, `2c` and `3k` are reachable; a single-vote room pays one point and a one-line room asks for one caption. | ✅ done |
| **8** | Hats — a second cosmetic beside the face, on both entry screens, plus the crown the leader wears. | A hat picked at the door rides every avatar from 34px up; the room crowns whoever leads and takes it back when they are overtaken. | ✅ done |
| **9** | Usability: the room narrates itself, a dropped tab stops being a phantom player, the host has to mean a close, and the react lane gets a layout audit. | A mode switch reaches every player; a guest closing a tab mid-round ends the wait instead of extending it, and raises nothing in the console; the responsive sweep covers both modes. | ✅ done |

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

**Phase 9 was four bugs that shared one cause: state nobody read.**

`ChatMessage.announcement` had existed since phase 2 with a comment saying it
was waiting for an action. `Player.connection` had four writers and — outside
the reconnect overlay — no reader, so `competitorCount` was `players.length - 1`
and a closed tab kept its seat in every denominator. `seatHeldUntil` is still
derived and still unconsumed, and [ADR 0029](./adr/0029-a-held-seat-does-not-hold-the-round.md)
now says why rather than leaving it looking like an oversight.

Four things changed shape:

1. **An announcement is published by the engine, off the transition.** Not by
   the screen that taps: a screen fires even when the action is refused, no
   screen fires at all for a drop, and under `?as=` the tapping tab is not the
   host. `HostEngine.commit()` diffs before and after, which covers the lobby's
   control and the toolbox's with one rule ([ADR 0028](./adr/0028-the-room-speaks-in-its-own-lane.md)).
2. **Both sides of a phase gate count the same people.** Filtering only the
   denominator is a bug that ships easily: a held seat holds its *entry* too, so
   three-of-four submitted minus one of those three opens the gate while a
   present player is still typing.
3. **`reconcile` only reports seats presence has seen.** Absence proved nothing
   — a fixture room's players were never connections at all, and were being
   marked `reconnecting` the whole time. Harmless until the gates read the flag.
4. **`beforeunload` asks and `pagehide` acts.** One handler that did both would
   send the room to `podium` and then leave a live tab sitting in it when the
   host clicked Cancel.

The layout audit found nine spots and one of them was the reported bug: the
Prompter's preview was `flex: none` at a width borrowed from an unrelated token,
beside a form on `flex: 1 1 0` that absorbed everything else. The rest surfaced
because `e2e/responsive.spec.ts` had only ever swept the react lane's *first*
screen — the answering half had never been measured at its own widths.

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
3. **The Slackmoji blocker belonged to user uploads, not to these tiles.** See
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

## After the phases

**The boot interstitial.** Not a phase — the room's join screen, which had been
a paragraph since phase 1 and was the last thing in the flow with no design.
Host and guest now get their own, and the audit that produced them is
[ADR 0015](./adr/0015-a-progress-screen-may-not-invent-a-stage.md): of the six
checklist rows the mockups drew, three named real work, one was a mislabel, and
two described work the app does not do. The copy moved onto the sequence rather
than the sequence being faked to match it.

Two bugs fell out of drawing the steps, both invisible while the boot was a
sentence. The hand-off fired on the first broadcast rather than on being seated,
so a guest briefly saw a lobby they were missing from. And a refusal arriving
before seating — a full room, a duplicate nickname — published into a snackbar
the boot branch returned before rendering, leaving the spinner turning forever.

**The caps came off.** Not a phase either — the Klipy production key was
approved on 2026-09-01, which removed the premise every room limit rested on.
`MAX_PLAYERS` is 20, `ROUNDS_MAX` is 10, `roundsMaxFor()` and
`SEARCHES_PER_ROUND` are gone, "Shuffle results" is back on the picker and chat
has its GIF panel again (lazily mounted, which was ADR 0021's real finding).
[ADR 0026](./adr/0026-the-rooms-limits-are-a-design-choice.md) supersedes
ADR 0021 and records why none of it needed a measurement to justify. The vote
board at nineteen submissions is the new binding constraint; `?bots=19` reaches
it.

**The picker stopped drawing holes.** Not a phase — a refinement, and the
obvious one once the landing wall had a treatment for waiting media that no
other surface used. A picker board is fifty lazily-loaded tiles and a vote grid
is up to nineteen cards; each reserved its image's real ratio and then left the
reserved area transparent until the bytes landed, and forever where they never
did. `TunedImage` puts `TvStatic` behind both, veiled with the same
`$scrim-static` every other set wears.

The decision worth knowing is what a set does when the picture never comes:
[ADR 0027](./adr/0027-a-tile-that-never-tunes-in-keeps-hissing.md) — a backdrop
settles to nothing and a tile settles to a dead channel, because a backdrop is
behind a sentence and a tile *is* the content. Fifty tiles all tuning was
measured rather than assumed and costs nothing (median frame 16.7ms, worst
16.8ms of 182).

**A second pass took the other five**, which the ADR records as an amendment:
the composer's staged attachment and its "Replying to" thumb, a sent message's
attachment and its quote thumb, and the vote screen's own subject thumbnail. It
turned up a bug older than any of it — a broken image is an inline non-replaced
box, so CSS width and height do not apply, and that 88px thumbnail had been
collapsing to a strip of spilled alt text since it was written. Three
neighbouring gaps are still deliberately open:

- **The cold board.** Before the first search lands there are no tiles at all,
  only the line `Looking…`. A mosaic of ratio-varied sets would stop the board
  jumping to full height when results arrive, but it needs invented ratios.
- **A new search, and "Shuffle results".** `useGifSearch` never clears
  `results`, so the previous board stays up with no signal that anything is in
  flight.
- **The chat composer's popover.** Provider-backed and equally blank, but a
  dozen flickering thumbnails over a live chat rail is a different amount of
  noise. It is `tuning={board}` → `tuning` if that reads wrong.

## Before launch

Not a phase — a gate. Do these when the room stops being a dev toy.

- [x] **Apply for a Klipy production key.** Approved 2026-09-01. Every cap in
      [ADR 0021](./adr/0021-the-rooms-limits-are-a-rate-limit.md) was arithmetic
      on the 100-an-hour test key; a production key is free and unmetered, which
      made those caps a design choice rather than a bill —
      [ADR 0026](./adr/0026-the-rooms-limits-are-a-design-choice.md) is where
      they were re-set. **Make sure `.env.local` and the deployed environment
      hold the *production* key**, not the test one: nothing in the app can tell
      them apart, and a full room will outrun a test key.
- [ ] **Turn ads on in the Klipy Partner Panel.** The free production tier is
      ad-funded and ad objects arrive inline in the results. The adapter no
      longer drops them (`0826dd7`) and `AdSlot` renders them in a sandboxed
      iframe above the board — but **no key here has ever been served a real
      one**, so that path is built and unexercised. A production key is the
      first chance to check it end to end.
- [ ] **Swap the keys.** `NEXT_PUBLIC_KLIPY_API_KEY`, `NEXT_PUBLIC_GIPHY_API_KEY`
      and `ABLY_API_KEY` in `.env.local` are personal development credentials:
      the GIF keys spend a personal rate limit and the Ably key bills a personal
      account. Issue project-owned keys and set them as deployment environment
      variables, not a file in the repo. Both GIF keys ship to the browser by
      necessity ([ADR 0020](./adr/0020-giphy-is-called-from-the-browser.md),
      [ADR 0022](./adr/0022-the-gif-provider-is-a-seam.md)) — issue web-only keys,
      and be ready to rotate.
- [ ] **Check `NEXT_PUBLIC_APP_URL`.** Unset is right in development; in
      production it must be the real origin, or the lobby's QR code encodes a
      link no phone can reach.
- [ ] **Clear `ABLY_STUB` and `NEXT_PUBLIC_GIFS_STUB`** in the deployed
      environment. The URL levers are already gated to non-production; these are
      not.
- [ ] **Decide about a production Giphy key.** Lower stakes than it was: Klipy
      is the default and its production key carries the room, so Giphy is the
      fallback adapter rather than the road. On its free 100/hour a full room no
      longer fits at all — the caps that used to make it fit are gone
      ([ADR 0026](./adr/0026-the-rooms-limits-are-a-design-choice.md)) — so the
      real choice is a production key or accepting that `?gifs=giphy` is a
      development lever and a small-room fallback. Giphy quotes production
      pricing privately and only after an application.
- [ ] **Widen `allowedDevOrigins`** only for LAN testing, never for the deployed
      build.

## Decisions already taken

| | Decision |
| --- | --- |
| Authority | The host browser is the server. Ably is pub/sub + presence. No database. |
| Role holder | **Does not compete.** Sets the round up, sits it out, then votes. That used to double as the cost model — a room of N fields N−1 pickers per round, which `roundsMaxFor()` priced — and is now purely a game rule. |
| Uploads | **Not a feature.** Priced the storage target and removed the scaffolding — [ADR 0014](./adr/0014-uploads-are-not-a-feature.md). Giphy covers both modes. |
| GIFs | **Klipy by default, Giphy as a second adapter**, both called from the browser with a public key ([ADR 0022](./adr/0022-the-gif-provider-is-a-seam.md)). Giphy's terms forbid proxying and caching ([ADR 0020](./adr/0020-giphy-is-called-from-the-browser.md)); Klipy's production key is free and unmetered, which is why it is the default. The room's caps **no longer come from an allowance at all** — the production key landed and [ADR 0026](./adr/0026-the-rooms-limits-are-a-design-choice.md) re-set them as game design, superseding ADR 0021. `lib/gifs/usage.ts` stays as the only thing counting what a full room spends. The wall, the waiting backdrop and the 404 are Klipy too, resolved in the browser from committed *slugs* — a build-time importer and a committed media URL are both things Klipy's terms rule out ([ADR 0025](./adr/0025-the-app-remembers-slugs-not-urls.md)). |
| Chat | Deferred to phase 6; it is a `RoomEvent`, never game state. The GIF picker is back and **mounted lazily** — what ADR 0021 actually found was that mounting one *on join* cost every player a call, which is still true and is why `useGifSearch({ enabled })` gates it ([ADR 0026](./adr/0026-the-rooms-limits-are-a-design-choice.md)). |
| `format:'one'`, `voting:'single'` | Implemented in phase 7. Both were live controls in `/host` that no screen read — a single-vote room paid 3/2/1, and "One line" changed nothing but a summary label. |
| GIF search toggle | **Removed, against the design.** `giphyEnabled` was a `/host` toggle nothing read, and it offered a room state the game cannot be played in — both modes need a GIF every round. `?gifs=stub` covers the real want ([ADR 0022](./adr/0022-the-gif-provider-is-a-seam.md)). |
| Help modal | Never pauses the room. Only the host's explicit pause stops the clock. |
| Announcements | The room speaks in the chat lane, on its own `RoomEvent` kind, published by the **host engine** and carrying a code rather than a sentence ([ADR 0028](./adr/0028-the-room-speaks-in-its-own-lane.md)). A mode switch, a drop and a return get a line; a *join* deliberately does not — the roster already draws it. |
| A held seat | Holds the seat, the entry and the points. It does **not** hold the round: the moment presence reports a drop, that player stops counting toward every phase gate ([ADR 0029](./adr/0029-a-held-seat-does-not-hold-the-round.md)). The role is never reassigned mid-round — the fallback subject covers a Prompter who left, and renumbering the rotation is the thing the held seat exists to prevent. |

Accepted cost of host authority: **if the host's tab dies, the room ends.** The
host is now asked to confirm a close while a game is live — the browser's own
dialog, from `beforeunload`, which deliberately mutates nothing; `pagehide` is
what actually ends the room, so cancelling leaves it exactly as it was.
Phase 1 mitigates (`sessionStorage` snapshot per `rev`, `pagehide` →
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
| `?gifs=stub` | Serves offline sample art instead of calling the provider. `?gifs=giphy` / `?gifs=klipy` pin one for a page load. `NEXT_PUBLIC_GIFS_STUB=1` does the stub permanently; a missing key falls back to it outside production. |

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
