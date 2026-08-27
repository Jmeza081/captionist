# 0003 — Host authority over a swappable transport

**Status:** accepted · 2026-08-27

## Context

A room is up to twenty phones watching one state machine: five rounds, a
rotating role holder, timed phases, ranked voting, sudden-death tiebreaks. That
state has to be the same everywhere, and it has to be right when a late joiner
arrives or a backgrounded tab wakes up.

The conventional answer is a server: a database, an API, and a job runner for
the clocks. Nothing in scope pays for that. There is no database, no
persistence requirement beyond a single sitting, and a game lasts minutes. Ably
was already chosen and installed for pub/sub and presence.

The sharper constraint was ordering. `design/` specifies all sixteen screens, so
there was nothing to discover by scaffolding them — but screens built against
invented props get refactored the day real state lands, and screens built
against a *synchronous* local stub get refactored the day the network lands.
Either way the refactor falls on the most expensive code.

## Decision

**The host's browser is the server.** It owns `GameState`, applies every action,
and broadcasts the result. Guests send intents and receive state; they never
decide anything and never self-advance a clock. Ably, when it arrives, is
transport — pub/sub and presence, not authority.

**Screens talk to a transport interface, not to Ably.** `RoomTransport` is
implemented three times: `LocalTransport` (now), `BroadcastTransport` (phase 4,
two tabs), `AblyTransport` (phase 5, two devices). Nothing above `useRoom()`
knows which one it got, so phase 5 changes one line — which implementation
`RoomProvider` constructs.

Three details are load-bearing rather than incidental:

- **The interface exposes the host/guest asymmetry.** `sendIntent`/`onIntent`
  and `publishState`/`onState` are deliberately not a symmetric
  `dispatch`/`subscribe` pair. Under Ably a guest's send is fire-and-forget
  with a real round trip, and that interval is a UI state — "Lock it in" goes
  pending and must not double-fire. A symmetric interface gives that state
  nowhere to live.
- **`LocalTransport` is artificially async**, ~80ms with jitter, and still
  defers to a microtask at zero latency. A synchronous local transport means no
  screen ever needs a pending state, which is the same refactor by a slower
  route.
- **Deadlines are absolute (`endsAt`), and `clock/expired` carries the phase it
  was scheduled for.** A late, duplicate or stale fire is then a reducer no-op,
  so there is no cancellation bookkeeping anywhere.

## Consequences

- **If the host's tab dies, the room ends.** This is routine rather than
  exceptional — a lid closing, a phone locking, iOS Safari evicting a
  backgrounded tab. Mitigated with a `sessionStorage` snapshot per `rev`,
  `beforeunload` → `host/left`, and a `visibilitychange` → `catchUp()` for the
  throttled-timer case. Not solved. A server-authoritative variant stays open
  behind the same interface if it ever needs solving.
- **Anonymity had to be structural, not cosmetic.** Host authority means every
  client holds the whole room, so "anonymous until the reveal" cannot be
  enforced by not rendering the author — devtools would defeat it. Ballots
  reference `EntryId`, never `PlayerId`, and `project()` strips authorship from
  the broadcast while voting is open.
- **Per-viewer projection does not map onto an Ably channel broadcast.** A voter
  keeps authorship of their own entry while everyone else's is stripped, so the
  host publishes one projection per recipient. A channel broadcast reaches every
  subscriber identically. Phase 5 must choose between a per-member channel and a
  shared broadcast plus a private "your entry is `id`" message. Recorded here
  because it is cheap to decide now and expensive to discover at swap time.
- **Full-state broadcast has a ceiling.** Ably caps a message at 64KB; twenty
  players is roughly 8KB — but only while nothing in `GameState` is a data URI.
  Avatars store a seed and media stores a URL for exactly this reason.
- **Bots are indistinguishable from people.** `BotDriver` sends intents through
  the transport rather than calling the reducer, so `?bots=4` exercises
  authorisation, ordering and the host's stamping of `at`. A reducer shortcut
  would have tested none of the code that actually breaks.
