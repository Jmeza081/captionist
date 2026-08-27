# 0004 — The host is not a special case

**Status:** accepted · 2026-08-27

## Context

[ADR 0003](./0003-host-authority-over-a-swappable-transport.md) made the host's
browser the server. That leaves an awkward player: the host is *also* someone
sitting in the room tapping buttons, and their taps have a shortcut available
that nobody else's do. `RoomProvider` took it — `send()` called
`engine.apply(action, HOST_ID)` directly, skipping the transport entirely.

It looked like an optimisation of an obvious no-op. It was neither.

Two things broke quietly once real screens existed:

1. **The host never heard "no".** `HostEngine.apply()` reports a refusal through
   `onRefused` only when it can name the intent that caused it, and a direct
   call supplies none. `authorize.ts` exists to return finished sentences —
   *"You set this round up, so you sit it out."* — and every one of them
   addressed to the host was being dropped on the floor. A blocked button
   looked broken rather than blocked.

2. **The host's sends resolved in the same tick.** The local transport defers
   delivery *always*, even at zero latency, precisely so no screen can assume
   its send already happened. The direct path was the one caller exempt from
   that discipline — and the host is the one player who exists today, so it was
   the discipline being exempted everywhere it was actually tested.

A third, related asymmetry sat in the clock. A guest measured `hostNow − now()`
once per broadcast and added that offset to local time. Under `?fast=` the
host's clock runs `rate` times faster, so between broadcasts the guest's
countdown advanced at 1× against a deadline sitting on a scaled clock: the
timer stalled, then snapped when the next state arrived. Invisible while the
only screen was a JSON dump; the first thing you notice on a screen with a
timer on it.

## Decision

**The host's own actions travel the transport, like everyone else's.**
`RoomProvider.send()` calls `sendIntent()`, which loops back through the bus
into the host's own `onIntent` handler and reaches `apply()` with an intent
attached. Refusals surface; the round trip is real.

**The clock's rate travels with it.** `StateMeta` carries `rate` alongside
`hostNow`, and `GuestClient` anchors both clocks rather than storing one
offset: `roomNow() = hostAnchor + (now() − localAnchor) × rate`. Like skew,
the rate is a property of the host's clock and the domain never learns it
exists.

**A seat other than the host's is reachable in development.** `?as=p2` builds
the local endpoint as a genuine guest — its own transport, its own `selfId`,
`isHost: false`. It requires `?phase=`, because it takes a seat that already
exists and filling an empty one is joining, which is phase 4.

## Consequences

**The host's own taps now cost a round trip** — ~80ms with jitter on the local
transport. This is deliberate. It is the same latency every other player pays,
and it is the only way the pending states a real network needs get exercised
before that network exists.

**Refusals became a product surface.** `useRoomRefusal()` feeds `RoomShell`'s
snackbar, so every rejected action anywhere in the app explains itself in the
domain's own words, with no per-screen error handling. The lobby's blocked
start is covered by a test that asserts the sentence, which exercises the whole
path: intent → transport → authorise → refuse → snackbar.

**The guest path is under test a phase early.** `?as=` means the code phase 4
depends on is exercised now, rather than being discovered when
`BroadcastTransport` lands. It also unlocked the compose and waiting faces,
which are unreachable as the host: round one's role holder is `players[0]`,
which is the host, and the role holder sits the round out.

**Accepted cost:** two endpoints now exist in one page in the `?as=` case,
which is not how production works — there, a guest is a different browser.
The shapes are the same, and the local bus is explicitly a development
implementation, so the divergence is in latency and process, not in contract.
