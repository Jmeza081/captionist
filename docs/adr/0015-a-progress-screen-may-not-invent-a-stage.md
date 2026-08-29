# 0015 — A progress screen may not invent a stage

**Status:** accepted · 2026-08-29

## Context

Booting a room rendered six lines of JSX: a bare `<AppHeader />` and one
paragraph reading "Joining the room…". It served host and guest identically —
`isHost` is not knowable at that point by design — and it offered no interactive
element at all, so a player whose join was refused had the browser back button
and nothing else.

Two mockups replaced it, each drawing a three-row checklist of what the room was
doing. Auditing those six rows against the code found that **half of them
described nothing**:

| Drawn | What the code does |
| --- | --- |
| Guest · Finding the room | Real — the seat probe, then the presence election. |
| Guest · Checking the room settings | Nothing checks them. They arrive inside the first broadcast. |
| Guest · Seating you in the lobby | Real — the `player/joined` round trip. |
| Host · Reserving your room code | Nothing reserves it. `generateCode(Date.now())` is pure local computation, and under [ADR 0003](./0003-host-authority-over-a-swappable-transport.md) there is no server to reserve it with. |
| Host · Loading the image deck | There is no deck. `/api/gifs` is called lazily inside the round screens. |
| Host · Opening the waiting room | Real — `engine.start()` and its first broadcast. |

The host's footnote was the same shape: "Your room stays open for 30 minutes"
is a timeout nothing implements.

Two roads out. Either **fake the work to match the copy** — a synthetic timeline,
or a GIF prefetch invented so the deck row could be true — or **move the copy
onto the work**. The first was tempting for one of them: prefetching trending
GIFs at host boot is real work with a real payoff, and would have made "Loading
the image deck" honest. It was still a feature being added to justify a
sentence.

## Decision

**Every row on a progress screen names a milestone that actually resolves, and
the screen hands over exactly when the last one does.**

Three consequences follow from that one rule.

1. **The copy moved.** "Reserving your room code" became *Claiming your room
   code* — the presence election genuinely contests the code on the channel.
   "Loading the image deck" became *Setting your rules*. "Checking the room
   settings" became *Waiting for the host*, which is the wait that is really
   happening. The footnote says what is true instead: joining is legal in any
   phase, so players can drop in between rounds.

2. **The hand-off is `isSeated`, not `!state`.** A first broadcast only proves
   the room exists; a guest still has to be given a seat. The old gate handed
   over on the broadcast, so the lobby briefly drew a roster the viewer was
   missing from — and "Seating you in the lobby" would have been a row that
   completed before the thing it names. One exported predicate now decides both
   the hand-off and what counts as a failed join, so the two cannot disagree
   about what *joined* means.

3. **The pacing has a floor, and the floor never runs ahead.** On the tab
   transport the whole boot resolves in a few hundred milliseconds, which draws
   three rows flicking to done inside a frame. `useBootTimeline` holds a row for
   `STEP_MIN_MS` before it may be marked done and the screen for `BOOT_MIN_MS`
   before it hands over — but it can only ever be *behind* reality, never ahead
   of it. Both floors scale by `?fast=`, and a `?phase=` fixture skips them
   entirely: that tab **is** the room, it asks no server for a seat and claims
   nothing, so pacing it would be the invented stage this ADR exists to refuse.

## Consequences

**A refusal has somewhere to land.** The screen's own failure slot is now the
only place a pre-seating refusal can go, and it was previously going nowhere: a
full room or a duplicate nickname published a refusal into the snackbar, which
the boot branch returned before rendering. The room said no into silence and the
spinner kept turning. `RoomProvider` routes a refusal arriving before
`isSeated` into `boot.failure` instead — deliberately at the transport boundary
rather than in `announce`, because the in-process callback carries the *host's*
own mid-game refusals and a host is never refused a seat in a room they built.

**The boot is now reported state, not an absence.** `RoomSnapshot` carries a
`BootProgress` — stage, role, and an optional failure — where the async boot had
previously only `setError` to speak through. It is the second thing that effect
can say, and the first that is not a dead end.

**Which screen shows is seeded by intent and corrected by the claim.** The
election takes 180ms on the tab transport and 400ms of settle on Ably, which is
long enough that a host seeded as a guest opens on the wrong title and flips. The
seed reads two signals that are already synchronous at mount — a fixture
declares itself the room, and a tab arriving from `/host` left its settings in
`sessionStorage` — and the claim overrides it. That also covers the case no seed
can predict: a guest who typed a code nobody was hosting and won the election
anyway. They swap to the host variant mid-sequence, which is the truth about
what just happened.

**The rule generalises, and it is the cost.** Any future loading surface pays
this audit before it draws a step. Where the work does not exist, the honest
answers are to rename the step or drop it — not to build the work so the sentence
becomes true. Prefetching a GIF deck at host boot is still a reasonable feature;
it is just not a copy decision, and it does not arrive attached to one.
