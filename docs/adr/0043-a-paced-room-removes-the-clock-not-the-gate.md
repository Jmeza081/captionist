# 0043 — A paced room removes the clock, not the gate

**Status:** accepted · 2026-09-22

## Context

[Backlog §2.3](../backlog.md) asked for a room that never auto-advances, so the
host paces every phase. Pause (`host/paused`, ⌥P), a `Round timer` stepper and
`host/skippedPhase` already shipped, and all three catch a *running* clock. What
did not exist was a room that never runs one.

§2.3a scoped the work as **"chrome that would start lying"**: `TimerPill` and
`timerSuffix` rendering `0:00`, `ProgressRail` stranded, `WAITING_ALL_IN_MS`
dead weight, bots acting instantly on resume. Almost none of that survived
reading the code.

- `RoomShell`'s header ternary falls through to `undefined` when the clock is
  neither running nor paused. The pill does not render a lie; it does not
  render. That is already how `reveal` ships.
- `ProgressRail` is gated on `countdown.running`, and `timerSuffix` is only
  called inside the clock branch. Both fail closed by construction.
- `phaseLength` reads `WAITING_ALL_IN_MS` off the **tracker**, not the duration
  table, so the read-your-confirmation beat is untouched by any change to
  `durationFor`.
- `enterPhase` already maps a `null` duration to `{ status: 'idle' }`, and
  `host/skippedPhase` is already `bump(advance(state, at))` — the same
  `advance()` the clock called.

So the mechanism was complete. What was missing was a setting, and — the part
§2.3a never mentions — four strings that name a deadline.

## Decision

**`RoomSettings.hostPaced` is a duration setting and nothing else.**
`durationFor` returns `null` for `brief`, `compose`, `waiting`, `vote` and
`tiebreak`. Nothing in the reducer branches on it.

**`settleGates` is deliberately untouched.** It counts entries and ballots
against the roster and never reads the clock, so a paced room still moves itself
on *consensus*: compose ends when every competitor is in, vote when every ballot
lands. **The host taps for stragglers, not for everybody.** A room where five
people finish and then all wait on one person to notice is a worse room than the
one we have.

**`opener` keeps its 3.8 seconds.** It is an animation beat with nothing to
decide in it; holding it open would make the host tap to get past a transition.

**The advance control takes the slot the clock vacated.** `hostAdvanceLabel`
draws a host-only button in the header's trailing slot on exactly the four
phases that lost a clock and have no advance control of their own — `waiting`
has `waitingCopy.action`, and `reveal` and `score` have carried their own docked
buttons since phase 3. ⌥↵ is bound to precisely what that selector draws, so the
key and the button are one rule rather than two.

**Four strings branch on the setting**, because each names a clock: both
`briefCopy.timeoutNote`s, `waitingCopy.body`, and `roomRulesLine` — which
prints the compose cap, a rule a paced room does not play by, on the one line a
late joiner learns the rules from. The *behaviour* behind them is identical
either way — `host/skippedPhase` reaches the same `advance()`, fallback subject
and seed included — so only the trigger moved, and only the sentence changes.

**A fifth string was reworded rather than branched.** `HELP_STEPS` is a const
keyed by mode with no access to `GameState`, and "you can swap yours until the
clock runs out" was false in a paced room. Making the help modal a function of
room state to fix one clause is the wrong trade; "until the vote opens" is true
in both rooms, because that is the event either mechanism produces. Reach for a
sentence that does not care before reaching for a branch.

## Consequences

- **Zero new components, zero new tokens, no reducer change.** The feature is a
  boolean, a duration rule, two copy branches and a header slot.
- **The setting is lobby-only.** `room/settingsChanged` is gated to `['lobby']`
  in `actions.ts`, so a host chooses this when they open the room. Changing it
  mid-game needs either a widened guard or a dedicated action on the
  `host/switchedMode` precedent — **and a decision this ADR does not make**:
  what happens to a clock that is already running when the switch flips. Turning
  pacing on mid-phase either strands a running countdown or stops it, and
  stopping it is a third thing `host/paused` already does. Worth doing; not
  worth guessing.
- **"No phase clocks" is one case short of true, and the exception is
  load-bearing.** `phaseLength` short-circuits `waiting` onto the tracker
  *before* `durationFor` is consulted, so a paced `waiting` that everybody is
  already in still enters with a running 3s `WAITING_ALL_IN_MS` beat and a
  visible `TimerPill`. That is deliberate — it is the read-your-confirmation
  beat, and it is what keeps consensus advance working — but it means the
  setting's own hint cannot say "no phase clocks" flatly. It says "no countdown
  on a phase you decide in", which is the true claim: nobody is deciding
  anything in those three seconds.
- **A paced room can still strand itself.** If a competitor closes their tab
  without submitting, `activeCompetitors` drops them and consensus still fires —
  but a player who is present and simply never acts holds the phase until the
  host taps. That is the feature, and the button names what it costs
  ("Start voting without Jack"). The guest-side nudge was considered and left
  out: the room is co-located and `ReactionFloaters` already is one.
- **`?paced=1` joins the URL levers**, one-way, for the same reason `?voting=`
  and `?format=` exist — every fixture takes `DEFAULT_SETTINGS`, and reaching a
  paced room through `/host` → `sessionStorage` would drag a route boundary into
  a screen spec.
- **`ShortcutHint` takes a `cap`.** It hardcoded `P` and the sentence "Press Alt
  plus P". A second shortcut made that a prop rather than a copy of the
  component — a variant is a prop.
- **The default stays off.** "Timers are honest" is a design-system rule, and
  the honest default is that they exist. A host opts out; they do not opt in.
- **Found and not fixed here:** `BotPool.dwell` measures from `options.now()`
  while `host/paused` freezes only `Clock.endsAt`, so bots submit *during* a
  pause today. Pre-existing on `main`, unrelated to this change, and it means
  §2.3a's "bots act instantly on resume" misdiagnoses it. It wants its own
  commit.
