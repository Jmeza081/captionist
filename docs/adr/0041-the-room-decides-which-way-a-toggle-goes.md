# 0041 — The room decides which way a toggle goes

**Status:** accepted · 2026-09-21

## Context

Pause shipped as two actions, `host/paused` and `host/resumed`, each guarded on
the clock being in the state it expects. The caller picked:

```ts
send({ type: countdown.paused ? 'host/resumed' : 'host/paused' })
```

That is fine for a button and wrong for a keyboard shortcut, and the shortcut
is what exposed it. The listener is registered in a `useEffect`, and a `useEffect`
runs **after paint**. So there is a window — short, real, and reliably hit by a
test harness — in which the clock already reads "paused" on screen while the
bound listener still closes over `paused === false`. A second press inside that
window sends `host/paused` at an already-paused clock, the reducer correctly
returns the state untouched, and the room simply does not resume.

The failure looks like a dropped keystroke, which is the worst shape for a bug
to have: nothing errors, nothing logs, and the control is one a host reaches
for precisely when they are in a hurry.

Closing the window with a ref does not close it. A ref assigned during render
is refused by the lint rule that exists to stop exactly that, and a ref assigned
in an effect has the same post-paint lag as the listener. Adding `paused` to the
dependency array re-binds the listener correctly but does not help: the re-bind
is *also* after paint.

**The premise was wrong, not the plumbing.** The pressing tab does not know
whether the room is paused. It knows what it last rendered.

## Decision

`host/togglePaused`. The reducer reads `state.clock.status` — the only
authoritative answer there is — and delegates to the existing `host/paused` or
`host/resumed` case, so each direction still has exactly one implementation.

Both call sites use it: the keyboard shortcut and the toolbox button. The
button was never observed to fail, but it carried the same defect and there is
no reason to keep two ways of asking.

## Consequences

- **The listener's dependencies lose the clock's state.** It depends on whether
  there *is* a clock, not on what the clock is doing, so it binds once per
  phase instead of re-binding on every pause. That is a simplification the
  toggle paid for rather than a separate tidy-up.
- Client-side optimism about a toggle's direction is now a thing to look for.
  Anything that reads `X ? 'a' : 'b'` from rendered state and sends it to an
  authoritative reducer has this bug latent in it; the room is small enough
  that pause was the only one.
- `host/paused` and `host/resumed` stay in the action union and stay
  host-only. They are reachable, they are what the toggle delegates to, and
  a caller that genuinely knows the direction it wants — a test, a future
  "pause on disconnect" — should be able to say so.
- One more action type on a wire with a 64KB budget, carrying no payload. The
  cost is a string.
- It does not fix the general class. An effect-bound listener still sees stale
  values for anything else it closes over; what this removes is the *decision*
  from the closure. Where a future shortcut needs to read room state rather
  than just trigger a transition, it will need the same treatment — say what
  happened and let the reducer work out what that means.
