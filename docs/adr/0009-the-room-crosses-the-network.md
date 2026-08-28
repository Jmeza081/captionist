# 0009 — The room crosses the network

**Status:** accepted · 2026-08-27

## Context

[ADR 0003](./0003-host-authority-over-a-swappable-transport.md) put a
`RoomTransport` between the room and the wire and predicted three
implementations. This is the third, and the one the interface was shaped for.
It either proves the prediction or refutes it.

It proves it: **no method changed, and nothing above `useRoom()` was touched.**
The two edits phase 5 made to the interface's file were both comments — one
correcting a note that deferred a decision phase 4 had already made.

What did need answering was everything phase 4 had to fake because a browser
tab is not a network, plus a whole layer that turned out to be modelled and
inert. `SEAT_GRACE_MS` matched the design's "held for 60 seconds" exactly and
fed one field. `Player.seatHeldUntil` was written twice and read nowhere, so a
held seat was held forever. `Player.connection` had four writers and no readers,
and its `'gone'` variant had no producer at all. `player/reconnected` was
emitted by nobody — and a returning guest was *silently suppressed*, because
`player/left` holds the seat and the one-shot "am I listed" guard then saw them
as already handled. The `"7 here"` pill counted seats.

## Decision

**Ably is the only transport a real room takes.** No production fallback: a room
with no key says what to set rather than quietly degrading to something that
cannot leave the browser. Giphy can serve offline art because a picture is a
picture; there is no offline stand-in for other people.

The exception is the test suite, which runs on `BroadcastTransport` via
`ABLY_STUB=1` or `?transport=broadcast` — the same switch shape `GIFS_STUB`
uses. `lib/room/connect.ts` resolves it, so nothing upstream knows which road it
got. **The consequence is real and worth stating: every spec in the repo
exercises the tab transport, and the Ably path has no automated coverage at
all.** That is the price of a hermetic suite, and it is why the roadmap records
phase 5's gate as unverified rather than done.

**Presence elects the host**, replacing phase 4's claim probe. A probe needs a
timeout tuned to a network; presence is a fact Ably keeps, so the question is
just "is one of the members already the host". The tie resolves the way the
claim did — lowest id, both clients reading the same set — so no round trip is
needed to agree.

**A seat is signed.** Ably makes `Intent.from` trustworthy for free: a token
minted with a `clientId` binds it, and the server rejects a publish claiming
another. That is worth nothing if a client can ask for a token bearing someone
else's id, and this app has no session to derive one from — the seat is minted
in a browser. So `/api/ably/token` mints it *and* HMACs it; a seat presented
without its signature is refused and a fresh one issued. The membership-token
table `BroadcastTransport` needed is gone, and the doc comment on `Intent.from`
is true here rather than aspirational.

**Presence drives the domain.** `HostEngine` reconciles the attached set against
the roster: a member vanishing is `player/left`, a member returning is
`player/reconnected`. That is the bridge that existed nowhere — the host already
detected drops and did nothing with the knowledge.

## Consequences

- **The reconnect overlay renders over a live room.** The old copy sat behind
  `if (!state)`, so it only ever fired for someone who never connected — never
  for the case it describes. `GuestClient` holds the last state independently,
  which is what makes the blur be over something real.
- **Two things the design draws are not built, and both for the same reason.**
  It writes `Reconnecting… attempt 3`; the transport retries internally and
  reports no count, so a number would be invented from a timer. And it always
  counts down 60 seconds; a seat is held by the *host*, so when the host is what
  vanished there is no deadline and the copy says so instead. Both are the rule
  that dropped the reveal's `auto-advancing in 6s`: a label with nothing behind
  it is worse than none.
- **The host-left screen is ours, not the design's.** `host/left` lands on
  `podium`, so a guest whose host closed a laptop saw final standings mid-game
  with no explanation. The design draws no screen for it — the closest written
  source is ADR 0007's "the room ends with its host" — so `podiumCopy` branches
  and says what happened. Its action is a link to `/host`, because a room with
  no host has nothing to restart.
- **`'gone'` finally has a producer**, and it is not an action. It is
  `seatState(player, now)` — a deadline passing, not something that happens to a
  player, which is why no reducer case could ever have produced it.
- **`LocalTransport` remains the test bus for unit tests.** `room.test.ts`
  drives a virtual clock, and neither `BroadcastChannel` nor a WebSocket answers
  to one.
- **Ably's two-minute line is now a thing the room depends on.** Inside
  `connectionStateTtl` a reconnect resumes with message continuity; past it,
  queued messages are dropped and `ChannelStateChange.resumed` is false. The
  host republishes on presence, which covers it — but that is the mechanism, and
  it is worth knowing it is the mechanism.
- **A token error is not fatal.** Ably downgrades a `4014x` from `failed` to
  `disconnected` and refetches once. Treating one as terminal would end a room
  over a routine renewal.
