# 0030 — A confirmation may not be the departure

**Status:** accepted · 2026-09-01

## Context

The room ends with its host. Phase 1 accepted that and mitigated it, and one of
the mitigations was a `beforeunload` handler that applied `host/left` — sending
the room to `podium` so nobody sat waiting on a tab that had gone.

Playtesting asked for the obvious next thing: make the host confirm. A stray
⌘W ends a game for up to twenty people, and the browser will put a dialog in
front of that for the cost of one `preventDefault()`.

**On the same handler, that is a bug.** `beforeunload` fires *before* the
dialog, not after it — there is no "they confirmed" callback, and the event
carries no answer. So a handler that both asks and applies would send the room
to `podium` and then, when the host clicked Cancel, leave a live tab sitting
inside a finished game. The worst version of the accident it was added to
prevent, reached by the button that was supposed to prevent it.

There is a second, quieter reason the old handler was already wrong for both
roles. `beforeunload` also fires for a page being frozen into the back/forward
cache — a tab you navigated away from and can navigate back to. The guest's
copy of this handler sent `player/left`, which was survivable while that only
held a seat. [ADR 0029](./0029-a-held-seat-does-not-hold-the-round.md) made it
drop you out of the round's gates, so the same freeze now hands the room a
departure the player never made.

## Decision

**Asking and leaving are two events.**

- **`beforeunload` asks, and mutates nothing.** It calls `preventDefault()` and
  returns. The host only, and only while there is a game to lose — not `lobby`,
  where nothing exists yet, and not `podium`, where the scoreboard has already
  been read. The dialog's wording is the browser's; it is not ours to write.
- **`pagehide` leaves.** It fires when the page really is going, and
  `event.persisted` distinguishes a genuine departure from a bfcache freeze.
  The host applies `host/left` there; the guest sends `player/left` there, with
  the same guard.

Guests are not asked. Their seat is held and rejoining works, so friction there
buys nothing — but they take the `persisted` guard, because that half is about
correctness rather than about confirmation.

## Consequences

- Cancelling a close leaves the room exactly as it was, which is the whole
  point and is not something either handler demonstrates on its own — hence
  this file.
- Playwright's `page.close()` defaults `runBeforeUnload: false`, so the suite is
  unaffected. `e2e/reconnect.spec.ts` closes the host and asserts the *guest*
  sees the room drop; that comes from presence dying, not from `host/left`, so
  it holds either way.
- **We cannot test the dialog.** No automation can answer a native
  `beforeunload` prompt, so the guard's own behaviour is verified by hand. What
  is testable — and tested — is that the room survives the cancel, because
  nothing mutates until `pagehide`.
- A tab restored from bfcache rejoins nothing, because it never left. This
  removes a class of phantom departure that ADR 0029 would otherwise have made
  visible in the phase gates.
