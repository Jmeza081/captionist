# 0007 — The first tab to ask owns the room

**Status:** accepted · 2026-08-27

## Context

[ADR 0003](./0003-host-authority-over-a-swappable-transport.md) made the host's
browser the server and put a `RoomTransport` between the room and the wire, to
be implemented three times. Phase 4 is the second implementation, and the first
where two endpoints are in different browsing contexts.

Everything above `useRoom()` survived that unchanged, which was the point. Three
things below it did not, and one of them was a hole rather than a gap.

**Nothing answered "does this room already exist?"** Every tab opening
`/room/[code]` called `createRoom()` and made itself the host, so typing
somebody else's code opened a different room wearing their code. The interface
had no notion of an existing room to join.

**A refusal had no way home.** `authorize.ts` returns finished sentences and
`HostEngine` handed them to an `onRefused` callback. That reaches the asker only
while every endpoint shares a page. `docs/architecture.md` recorded this as
phase 5's to fix; it was wrong, because a second *tab* is already a genuinely
remote guest, and a guest whose action was refused would have watched a button
do nothing.

**`project()` is per viewer, and a channel is not.** ADR 0003 flagged this as
the one part of the interface Ably would not satisfy for free, and deferred the
choice. `BroadcastChannel` is the same shape, so the choice arrived a phase
early.

## Decision

**The first tab to claim a code hosts it; the rest join.** A tab posts `claim`
on the room's control channel and waits ~180ms. Silence means the room is ours.
An answer carries a membership token and makes us a guest. Simultaneous claims
are broken by lowest id — both tabs see the same claims and reach the same
answer, so no second round trip is needed.

`/room/[code]` stays one route and every dev URL keeps working, which is what
made this safe to add under a suite that guards everything else. The harness is
the one exception and declares itself: `?phase=` boots a fixture that *is* the
room, so probing could only ever hand it to a stale tab.

**`RoomTransport` gains a refusal lane** — `publishRefusal(to, reason)` and
`onRefusal(handler)`. Addressed and private, because a refusal belongs to the
person who asked and broadcasting it would be both noise and a leak. The host's
own refusals still travel the in-process callback: it is in the room where the
decision was made, and putting them on the wire as well would show them twice.

**State goes out on one channel per recipient**, `captionist:<code>:state:<id>`,
rather than a shared broadcast with a `to` field. A shared payload would put
every other player's authorship into every tab's message handler — exactly the
leak ADR 0003 says devtools would defeat. Phase 5 inherits this answer.

**A seat is per tab, a person is per browser.** The nickname and face live in
`localStorage`; the player id lives in `sessionStorage`. Sharing one id across
tabs put both players in the same chair — the host addressed its own broadcast
to itself and the guest waited forever on a room that thought it had spoken.
Per-tab also survives a reload, which is what makes a seat reclaimable.

## Consequences

- **`Intent.from` needs a token to stay true.** Its doc comment promises an
  authenticated sender, which held only because one page built every endpoint.
  The host now issues a token per member and drops any message whose pair does
  not match. **Same-origin tabs are not a security boundary** and this does not
  pretend to be one; it keeps the comment honest until Ably issues identity for
  real.
- **A member appearing has to trigger a publish.** `recipients()` already
  unioned `members()`, but nothing published when that set grew, so a guest
  attaching after `start()` heard silence. `HostEngine` now republishes on
  presence. A guest also re-asks (`sync`) until state arrives, because the first
  publish after a claim can land before its inbox exists.
- **`isHost` is no longer knowable at mount.** It is the answer to a probe, so
  the store learns it rather than being told at construction, and it starts
  `false` — a tab that assumed otherwise would flash the host's controls at a
  guest.
- **Joining is legal in every phase now.** The lobby has always said "Late
  joiners can still hop in between rounds"; the guard said otherwise. A player
  arriving mid-round has no entry in it, so `competitors()` excludes them
  already — they vote, and compete from the next round.
- **`LocalTransport` is still the test bus.** `room.test.ts` drives a virtual
  clock, and `BroadcastChannel` will not answer to one. The new transport is
  verified in Playwright with two real pages, which is the only place its
  interesting behaviour exists.
- **If the host's tab closes, the room still ends.** Unchanged from ADR 0003,
  and now visible to other people rather than only to the host. Guests emit
  `player/left` rather than `host/left`, so a guest leaving holds a seat instead
  of ending a game they do not own. The reconnect overlay stays phase 5's.
