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
| **2** | `RoomShell` chrome, `LobbyScreen`, `BriefScreen`, `ComposeScreen`, `/api/gifs` + Giphy search. | Play to `waiting` on a phone viewport; timer, rail offset and toolbox all real. | ◻️ next |
| **3** | `WaitingScreen`, `VoteScreen`, `TiebreakScreen`, `RevealScreen`, `ScoreScreen`, `PodiumScreen`. | **A complete 5-round game, solo, vs 4 bots, both modes.** The milestone that matters. | ◻️ |
| **4** | Landing, `/join`, `/join/[code]`, `/host`, real room codes, join + nickname + avatar, `BroadcastTransport`. | Two tabs, one host one guest, a real game with no network. | ◻️ |
| **5** | `AblyTransport`, `/api/ably/token`, presence, reconnect overlay. Plus the ADR and the client↔API-route↔Ably diagram. | Two devices on the same wifi. | ◻️ |
| **6** | Chat + live reaction tallies on the event lane. | `ChatRail` fills; vote-card tallies go live. | ◻️ |

Nothing in phases 2–3 knows a transport exists beyond `useRoom()`, so **phase 5
changes exactly one line**: which implementation `RoomProvider` constructs.

## Decisions already taken

| | Decision |
| --- | --- |
| Authority | The host browser is the server. Ably is pub/sub + presence. No database. |
| Role holder | **Does not compete.** Sets the round up, sits it out, then votes. |
| Uploads | **Blocked in v1** — no storage target exists. `Dropzone` says why. |
| GIFs | Real Giphy, proxied through a route handler so the key stays server-side. |
| Chat | Deferred to phase 6; it is a `RoomEvent`, never game state. |
| `format:'one'`, `voting:'single'` | Rendered blocked with a reason; modelled, not implemented. |
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

Fourteen designed states resolve to **9 room phases and 10 screen organisms**.
`BriefScreen` covers `1g/1v/1x/1w/1h/3a/3b`; `ComposeScreen` covers
`1i/1s/3c/3d`.

## The four URL levers

Read once in `RoomProvider`, and **gated to non-production** so no test branch
can leak into a screen.

| Lever | Does |
| --- | --- |
| `?seed=42` | Fixes the PRNG, so the vote shuffle is reproducible and card selectors are stable. |
| `?bots=4` | Spawns bot guests *over the transport*, so one page plays a full room. |
| `?fast=10` | Scales the room's clock — a 5-round game in ~30s instead of ~5min. |
| `?phase=vote` | Boots from `lib/game/fixtures.ts` so a screen gets a spec without playing to it. |

`?fast` scales the host's clock rather than faking the page's: `page.clock` is
per-page, and with a host in one page and guests in others it would
desynchronise the room.

## A naming collision worth knowing

The `/feature` skill *also* has numbered phases (1 = research, 3 = design
artifact). **"Phase N" in conversation means this file's numbering.** Phases 0
and 1 have no visual surface, so `/feature`'s phases 1 and 3 were skipped there
under its escape hatch; from phase 2 on they apply.
