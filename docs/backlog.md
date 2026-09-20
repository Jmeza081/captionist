# Backlog

What is left after phase 9: a launch gate, one open defect, and four wishlist
items. The five defects originally here were fixed on 2026-09-14 and §2.1 and
§2.2 have since shipped — their entries stay below, marked, because each
records what was actually wrong and the decision that settled it. Compiled from
playtest feedback and re-derived against the code, because the report named
symptoms and the code names causes.

> **Read [`roadmap.md`](./roadmap.md) first.** This file is what is *left*; that
> one is what was *built*, and its "Before launch" gate is the source of truth
> for §0 below. Where the two disagree, the roadmap wins and this file is stale.

Ordering is **ship-blocking first** — what stops a real room sits above what
makes the game better.

**Two reported items are recorded here as non-defects** (§1.4, §1.5) rather than
dropped. A report that does not reproduce is worth writing down once, so the
next person does not re-investigate it or fix it into existence.

---

## 0 — The launch gate

Not code, and the highest-priority thing here. Every row is something the first
real room hits. The full text lives in [`roadmap.md`](./roadmap.md#before-launch);
this is the index.

| # | Item | Why it blocks |
| --- | --- | --- |
| 0.1 | **Swap the keys.** `NEXT_PUBLIC_KLIPY_API_KEY`, `NEXT_PUBLIC_GIPHY_API_KEY`, `ABLY_API_KEY` | They are personal development credentials. The GIF keys spend a personal rate limit, the Ably key bills a personal account. Issue project-owned, web-only keys and be ready to rotate |
| 0.2 | **Confirm the *production* Klipy key** is in `.env.local` and the deployment | Nothing in the app can tell a test key from a production one, and a full room outruns a test key |
| 0.3 | **Issue the Anthropic key from a project-owned org** — service account, workspace with **both** a spend *and* a rate limit | A monthly spend cap cannot notice a loop that burns the budget in an hour. Limits cannot be set on the Default Workspace |
| 0.4 | **Turn ads on in the Klipy Partner Panel**, then exercise the path | The free production tier is ad-funded. `AdSlot` is built and **has never been served a real ad** |
| 0.5 | **Clear `ABLY_STUB`, `NEXT_PUBLIC_GIFS_STUB`, `NEXT_PUBLIC_BOTS_STUB`** in the deployed environment | The URL levers are gated to non-production; these are not |
| 0.6 | **Check `NEXT_PUBLIC_APP_URL`** is the real origin in production | Otherwise the lobby's QR code encodes a link no phone can reach |
| 0.7 | **Email `developers@klipy.com` about the export** before the first real room shares a meme | Their Integration Requirements ask for it from any "custom implementation" — [ADR 0036](./adr/0036-a-shared-meme-is-rendered-where-it-is-watched.md) |
| 0.8 | **Create the `export-media` flag** in Vercel once linked; set `FLAGS_SECRET` | Until then `defaultValue` governs |
| 0.9 | **Decide about a production Giphy key** | Lower stakes now — Klipy carries the room. On Giphy's free 100/hour a full room no longer fits at all, since the caps that made it fit are gone ([ADR 0026](./adr/0026-the-rooms-limits-are-a-design-choice.md)). The choice is a production key, or accepting `?gifs=giphy` as a dev lever and small-room fallback |
| 0.10 | **Run the Ably path on two real devices** | Phase 5's gate, still open. Everything is built and covered, but the suite runs on `BroadcastTransport` and **nothing here has ever run against Ably**. Check `allowedDevOrigins` in `next.config.mjs` excludes the LAN address a phone uses, and that `NEXT_PUBLIC_APP_URL` is unset in development |

---

## 1 — Defects

**The original five were fixed on 2026-09-14.** Each entry keeps its diagnosis
and now carries the resolution in bold at the top. The two non-defects (§1.4,
§1.5) stay as records.

**§1.6 is open**, and did not come from a playtest — it was found on
2026-09-20 while deciding against vote attribution in §2.2. It is the only
unfixed correctness item in this file.

### 1.1 Tiebreak — four separate defects

**Fixed.** (a) `resolveTiebreak` hoists the duel's winner to the head of
`ranking`. (b) The copy now says "Still level after that, and we flip a coin" —
the role holder does *not* get a deciding vote; they sit the round out and
weighting their vote would be a rule change. (c) The exclusion line reads
"can't vote for their own entries". (d) A zero-ballot round commits with no
winner and no points, and the reveal says "Nobody voted. Nobody wins." All four
are in [ADR 0037](./adr/0037-a-round-nobody-voted-in-has-no-winner.md).
Reachable at `?phase=reveal&votes=0`.

Not one bug. Ordered by what a player notices.

**(a) The reveal can tell the duel's loser they came first.** `scoreRound` builds
`ranking` from the *pre-tiebreak* points; `resolveTiebreak` then overwrites two
fields and carries `ranking` through untouched:

```ts
const result: RoundResult = { ...tiebreak.pending, winnerEntryId: winner, points }
```

Contenders are tied by definition, so a stable sort leaves them in entry order
and `ranking[0]` is whichever was submitted first — independent of who won the
duel. `myRoundPlacement` reads that stale array and renders `You finished
{ordinal} this round`, so the loser can be told they finished 1st on the screen
that crowns the winner.

*Fix:* re-sort `ranking` on post-bonus points, or hoist `winner` to index 0,
before `commit`. `lib/game/reducer.ts` — `resolveTiebreak`.

**(b) The copy promises a deciding vote the code never gives.** The tiebreak body
says *"The {Captionist|Prompter} gets the deciding vote if it's still level."*
`resolveTiebreak` never mentions `roleHolderId` — a persisting tie goes to the
seeded PRNG. `selectors.test.ts` (*"names the role that breaks a persisting
deadlock"*) asserts the role name is present, so **the test locks the false
promise in** and has to change with whichever way this goes.

*Decision needed:* give the role holder's vote deciding weight, or stop naming a
person and say the room's own words for a coin flip. This is a product call, not
a fix.

**(c) An overclaimed exclusion line.** `exclusionLine` reads *"Jack and Lukasz
can't vote in their own duel"*, built from every contender's author. The rule
bars only your *own entry* — Jack can and should vote for Lukasz's. The same
overclaim is in the type's docblock and a `TiebreakScreen` comment.
`selectors.test.ts` only asserts `.toContain('own duel')`, so it misses the
semantics.

*Fix:* word it as "…can't vote for their own entry", or drop the line and let
the per-card label carry it.

**(d) A room that does not vote gets a five-way "duel".** `pointsByEntry` seeds
every entry at 0, so if the vote clock expires with no ballots at all, `best` is
0 and **every entry becomes a contender** — five `MediaCard`s with `VS` rules
between them, on a screen written for a head-to-head. No test covers a
zero-ballot round.

*Fix:* treat `best === 0` as "no winner" and commit, or cap contenders at two.

### 1.2 Two strings promise uploads

**Fixed.** "…whatever the search box coughs up." and "Or arguing with the
search box." — no provider named, no folder promised.

[ADR 0014](./adr/0014-uploads-are-not-a-feature.md) removed the feature and its
scaffolding, but `briefCopy` in `lib/game/selectors.ts` still promises a personal
image source:

- *"You'll answer it with a GIF — Giphy, or something regrettable from your
  screenshots folder."* — the `promptwait` body
- *"Or rummaging through their screenshots."* — the `pickwait` second headline

The first is the worse one: a second-person promise, on the screen immediately
before a picker that offers a provider and nothing else. It also still says
**"Giphy"**, which is separate drift now that Klipy is the default
([ADR 0022](./adr/0022-the-gif-provider-is-a-seam.md)) — worth fixing in the
same pass.

**`design/DESIGNSYSTEM.md` still specs the uploader on purpose.** ADR 0014 left
it as a record of what was designed. Do not "fix" it.

### 1.3 The picker gives no feedback on a re-search

**Fixed.** While a board is out `GifPanel` takes the last one down and draws
placeholder tiles — `TvStatic` behind a `.tile` at the last board's ratios —
so nothing stale is pickable; an error keeps the last good board under the
message and the retry key; the samples note is no longer hidden on an empty
board. `fetchBoard` and `GifProvider.search` take the hook's `AbortSignal`,
combined with each adapter's timeout by `withTimeout`, so a superseded search
is cancelled on the wire and StrictMode's first arrival is torn down rather
than completed. Covered by "a board on its way" in `e2e/gifs.spec.ts`.

The whole empty/loading/error affordance in `GifPanel` is gated on
`shown.length === 0`, and `status` is read nowhere else in the component.

| | first search (empty board) | re-search (board populated) |
| --- | --- | --- |
| `board` and `popover` | `Looking…` | **Nothing at all** — stale tiles stay rendered and fully clickable |

So a player who re-searches and taps a tile submits a GIF from the query they
abandoned. That half is a correctness bug, not polish. The same gate swallows the
**error** branch and its "Try again" button on any re-search; conversely the
sample-fallback `message` is suppressed exactly when the board is empty, which is
when it is most needed.

Two related defects in `lib/gifs/useGifSearch.ts`:

- **The `AbortController` is decorative.** `run()` creates one and calls
  `abort()`, but `fetchBoard(query, cursor, limit)` takes no signal — the
  adapters attach only their own `AbortSignal.timeout`. Nothing is ever
  cancelled; correctness is saved only by the `latest` ticket guard, and every
  superseded search still completes.
- **StrictMode therefore puts two live requests on the wire** per picker mount,
  since the cleanup `abort()` is inert. Already acknowledged in `GifUsage.tsx`.

*Reuse, do not build:* `TvStatic` and `TunedImage` exist, and **`GifPanel`'s tile
already renders `TunedImage`** — a skeleton board is placeholder tiles at the
reserved `--tile-ratio`, not a new primitive. `WaitingDots` covers a wait with no
number attached.

### 1.4 "Duplicate share image" — not a duplicate

**Cache key fixed, and the suite can now see a duplicate.** `standingsJob`
takes the round and its id is `standings-${code}-${round}` (`final` on the
podium). `e2e/export.spec.ts` asserts through `expectSharedOnce`, which waits
for the first file, gives a second one room to land, then counts. The two
smaller things at the end of this entry (`run()`'s guard on any active job,
`prepare()` never setting `active`) and the multi-frame decode gap are still
open.

The renderer was run end to end against synthetic GIFs from 1 to 250 frames and
the output re-parsed. **The artefact is not duplicated**: N frames in → N frames
out, running time preserved, exactly one Netscape loop block, every caption,
credit and standings row painted once.

Seven mechanisms were checked and ruled out — the two-pass encode (separate
generators, only the second reaches the encoder), a StrictMode double-effect
(`fileFor` registers in-flight synchronously), two `ExportKey`s mounted at once
(one screen exists at a time), a double-queued job (`cache`/`inflight` keyed on
`job.id`), `deliver()` both sharing and downloading (the share branch
early-returns), a double-painted caption (the repeated `fillText` is a deliberate
four-way shadow standing in for CSS `text-shadow`), and a duplicated
loop-boundary frame (`sampleIndices` returns a `Set`; `budgetFrames` strides).

**But one real defect has the shape of the complaint.** The standings job id is
the constant `'standings'` (`lib/export/jobs.ts`) and blobs are cached by id with
**no content key**, so any second export from a still-mounted screen re-delivers
the first render's bytes. Latent today only because `RoomShell` swaps screen
components between phases, so the cache dies with the mount — live the moment the
score screen survives a round boundary.

*Fix:* give it an id that varies — `standings-${code}-${roundNumber}`.

**Before changing the renderer, settle which of three things was seen:**

| Reading | Verdict | Fix |
| --- | --- | --- |
| *Two files arrived* — the sheet opened **and** a download started | Possible, uncovered | Means `canShare({files})` returned false at delivery after true at the capability check — the sheet's per-file size check. Fix is a fallback **inside** the share branch, not falling through it |
| *The same picture twice* | **Most likely** | The constant `'standings'` cache key, above |
| *The GIF plays its content twice* | Ruled out, 1–250 frames | — |

Two coverage gaps worth closing regardless:

- **The suite cannot detect a duplicate delivery.** Four assertions in
  `e2e/export.spec.ts` use `expect.poll(() => sharedFiles(page)).toHaveLength(1)`,
  which succeeds the instant the array first reaches 1 and never re-checks. A
  second `share()` landing 50ms later is invisible to all of them. Needs a
  settle-then-assert, or a counter checked after the snackbar.
- **ADR 0036 records that the suite only exercises the one-frame road** — the
  runner blocks every host but loopback and the shelf is SVG, so the multi-frame
  decode was checked by hand against a live Klipy round. That is the hole this
  report landed in.

Two smaller things in the same subsystem: `run()` guards on `active !== undefined`
rather than on *this* job, so tapping a second card's export key on the vote grid
while another renders does nothing — no tint, no snackbar, a silent swallow. And
`prepare()` never sets `active`, so the reveal's idle pre-render shows no
progress on the happy path.

### 1.5 "3–20 players" — not a defect

Recorded because an earlier pass flagged it.
[ADR 0026](./adr/0026-the-rooms-limits-are-a-design-choice.md) restored
`MAX_PLAYERS = 20` and `ROUNDS_MAX = 10` once the Klipy production key made the
caps a design choice rather than a bill, so the landing page is accurate. The
per-round search budget is gone entirely for the same reason — which is also why
`Chip`'s `blocked` prop currently has no production consumer.

### 1.6 The reveal hands every guest the ballots — open

Found while deciding against vote attribution (§2.2), not reported by a
playtest. `lib/game/project.ts` redacts `entry.authorId`, and only during
`vote` and `tiebreak`. It never touches `round.ballots` at all. At `reveal`
the authors come back, so any guest can pair the two in devtools and read who
ranked whom.

Nothing in the product promises voter anonymity in so many words — §4.5's
guarantee is about *entries*. But nobody decided voters were nameable either,
and `project.ts` exists precisely to enforce this sort of thing by redaction
rather than by nothing having asked yet. The room is played by colleagues;
"Jesse put you last" is a retro argument the game should not be able to start.

*Fix:* project `ballots` down to the viewer's own ballot, at every phase — the
vote grid needs it for `RankSlot` and needs nobody else's. Add a
`project.test.ts` case. The honest aggregate the room is entitled to is already
shipped as `RoundResult.points`.

*Why it is not done:* it changes what guests receive over the wire. That is a
different kind of change from a rendering pass and deserves its own gate.
`redactTiebreak` is the cautionary tale sitting right beside it — it exists
because a redaction leaked by a second route.

---

## 2 — Features

Sizes assume the [`/feature`](../CLAUDE.md#feature-workflow) pipeline.

### 2.1 Lock a GIF once taken — small/medium

**Shipped 2026-09-14.** Built as described below, with every one of its three
non-obvious points honoured: matched on `mediaKey` (origin + pathname), marked
rather than hidden with a label rather than a bare tint, and enforced in the UI
rather than the reducer. A same-instant collision is **accepted** — both entries
land and the reveal shows two of the GIF — because refusing the second needs a
`BotPool` re-pick loop that does not exist and a stub corpus bigger than twelve.
[ADR 0038](./adr/0038-a-taken-gif-is-marked-in-the-picker-not-refused-by-the-reducer.md).

In `react` mode, a GIF another player has already submitted becomes unpickable
for everyone else, live.

**Cheaper than it looks.** `project()` redacts only `entry.authorId`, and only
during `vote` and `tiebreak` — during `compose` it returns state by identity. So
every client already holds every submitted answer, broadcast on each `rev` bump.
The taken set is one selector over `state.round.entries` with **no new wire
traffic**, and it updates live for free.

Three things that are not obvious:

- **`MediaRef` has no id — `src` is the only key, and it is not uniformly
  stable.** Klipy's `src` is a bare CDN URL with no query string and compares
  cleanly. Giphy's carries per-request `?cid=…&rid=…`, so two players who
  searched separately can hold byte-different strings for the same GIF.
  Normalise on origin + pathname. (Klipy's *slug* is the opposite — it carries a
  per-response token and is not durable, so `src` is right and an id would be
  wrong.)
- **A taken tile is marked, never hidden.** Both providers forbid reordering,
  removing, suppressing or filtering results. And because the reason is
  off-screen — another player did something —
  [ADR 0032](./adr/0032-a-blocked-label-counts-what-is-missing.md) puts it on the
  counting side of the line: it takes a label, not a bare tint. This would be
  `Chip.blocked`'s first production consumer since ADR 0026.
- **Enforce in the UI, not the reducer.** `BotPool` marks a phase done *before*
  awaiting and discards the boolean `apply()` returns, so it has **no retry path
  for a refused submission** — a bot refused for a taken GIF would never submit,
  and the compose gate (`inHand >= roster.length`) would strand the round until
  the clock ran out. Separately the stub brain picks from a small positional
  shelf (`sampleAt`), and that is the road the whole Playwright suite and any
  keyless clone take, so bots would collide constantly in exactly the
  configuration every test runs in. If the rule ever moves into
  `authorize`/`reduce`, `BotPool.answer` needs a re-pick loop first and the stub
  corpus needs to outnumber the roster. See
  [ADR 0034](./adr/0034-a-bot-is-the-hosts-puppet-not-a-peer.md) and
  [ADR 0035](./adr/0035-the-comedy-is-a-seam-and-its-key-cannot-be-public.md).

Also decide: two players can lock the same GIF inside one broadcast round-trip,
so the loser needs a graceful "someone just took that" rather than a silent swap.
`caption` mode is unaffected — one GIF, one picker, no collision.

### 2.2 Round results — small, and mostly already computed

**Shipped 2026-09-20.** The delta moved out of the note column and into the
score cell, under the running total and behind **neither** container query —
which turned out to matter more than the entry below knew. The note column
keeps rounds won. Whoever set the round up gets an em dash rather than `+0`
([ADR 0039](./adr/0039-a-role-holders-zero-is-an-absence-not-a-score.md)), and
the reveal's placement line is drawn at every width with the points appended.
Rank movement, places 4..N on the reveal, and vote attribution were all
considered and **left out** — see the three notes at the end of this entry.

**The diagnosis below understates it.** The note column is behind a 560px
container query measured on the row's own width, so the delta was not merely
eclipsed once someone had a round win — on a phone it had never rendered for
anybody. Two smaller things came with the fix: the standings `<ol>` had been
wrapping plain `<div>`s, so the list had no `listitem` children and a
twenty-player scoreboard announced as a list of nothing (`PlayerRow` takes an
`as` prop now); and `myRoundPlacement` no longer tells the round's winner they
came first, which the screen was already saying twice above it.

**What was left out, and why:**

- **Rank movement.** Five rounds and up to twenty players means round two moves
  nearly everyone, so an arrow on eighteen of twenty rows measures noise. It is
  also in no part of `design/`, and it was the only thing here that would have
  needed new gain/loss colour tokens and up/down glyphs. *If it is ever picked
  up:* suppress the indicator whenever the player is tied with anyone in either
  the previous or the current standings — `standings()` breaks ties on
  `localeCompare(name)`, so that is precisely when movement is a naming
  artefact rather than a result.
- **Places 4..N on the reveal.** The reveal is the room's one shared-screen
  beat. The placement line closes the same gap for the person who actually
  wants it, without a second scroll surface.
- **Vote attribution.** Out on product grounds — coworkers play this. But the
  investigation turned up something real and still open: `project()` redacts
  `authorId` at `vote` and `tiebreak` and **never touches `round.ballots`**, so
  at `reveal`, once `authorOf` is back, every guest holds who-voted-for-whom in
  devtools. Nobody decided that; it is incidental. The fix is to project
  `ballots` down to the viewer's own at every phase, plus a `project.test.ts`
  case. **Deliberately not done here** — it changes what guests receive over
  the wire, which is a bigger blast radius than the rest of this put together.
  Logged as §1.6 below.

`Standing` carries `delta` (points this round) and `roundWins` as separate
fields. `ScoreScreen` renders neither — only `note`, and `standingNote` collapses
the two:

```ts
if (roundWins > 0) return plural(roundWins, 'round won', 'rounds won')
return `+${delta} this round`
```

So **per-round points go invisible the moment a player has any round win.** The
numbers are on the row; this is a rendering change.

Same shape for the rest. `runnersUp` is `.slice(0, 2)` while `RoundResult.ranking`
holds the full ordering, so places 4..N exist in state and are never drawn.
**Rank movement does not exist anywhere**, but is derivable without new state
from `scoresFrom(history.slice(0, -1))` — with one caveat, that ties break on
`localeCompare(name)`, so a name-ordered tie can show phantom movement.

**Vote attribution needs a decision, not just code.** "Who voted for whom" *is*
derivable at the reveal — `round.ballots` survives until the next
`round/advanced` and `project()` does not redact it at `reveal`. But that is
incidental rather than intended, and `project.ts` exists to enforce anonymity by
redaction. Small if skipped, medium if not.

### 2.3 Manual advance — medium

"Skip this phase" already ships (`host/skippedPhase`, in `RoomToolbox`), and
`reveal`/`score` are already host-paced — their `PHASE_DURATIONS` are `null`.
**What does not exist is *not auto-advancing*.**

It cannot be a client toggle: `advance()` is reached from the pure reducer via
`clock/expired` and from `settleGates`, both host-authoritative. Minimum honest
shape is a `RoomSettings` flag that makes `durationFor()` return `null` for the
paced phases and `settleGates` stop at a "ready" state instead of calling
`enterPhase`. Then either widen `round/advanced`'s phase guard, or reuse
`host/skippedPhase`, which already does the right thing — the cheaper route.

The real work is **chrome that would start lying**. `TimerPill` and `timerSuffix`
("0:24 to pick") must render a waiting-on-host state rather than `0:00`;
[ADR 0015](./adr/0015-a-progress-screen-may-not-invent-a-stage.md) is the
precedent. `ProgressRail` is gated on `countdown.running`, so it fails closed by
accident. `WAITING_ALL_IN_MS` and the `waiting` phase's whole shorten-the-wait
mechanism become dead weight. And a long pause leaves bots' `dwell` targets
already past, so they act instantly on resume.

### 2.4 Audio — medium, and the assets are the smaller half

Background music and per-step sound effects. **Nothing exists today** — no audio
element, no files, no dependency. The only `muted` hits are `<video muted>` on
decorative backdrops.

- **Cue point:** an effect on `state.phase` in `RoomShell`, which already
  resolves `screens[state.phase]` and special-cases `opener`. Not the reducer —
  it is pure, no I/O. Urgency already has a signal in `isUrgent`/`URGENT_AT`.
- **Preference:** `localStorage`, `captionist:`-namespaced, following
  `lib/recent-reactions.ts`. The house rule is in `lib/room/identity.ts` — *the
  person is `localStorage`, the seat is `sessionStorage`* — and sound is a person
  preference. Never `GameState`: it would bump `rev`, the number guests drop
  stale updates against.
- **Shape:** mirror `useReducedMotion` — `useSyncExternalStore`, server snapshot
  defaulting to **silent**, the same instinct as "stillness is the safe guess".
  There is no `prefers-reduced-sound` query, so this is stored rather than
  queried; worth being explicit about.
- **Control:** `RoomToolbox`'s shared section, beside help — not `HostTools`.

**The hard part is the autoplay policy.** Browsers block audio until a user
gesture on the origin, and the room's first audible moment is a phase transition,
which is not a gesture. For a guest it is worse: their last gesture was on
`/join`, a different route, with `RoomBootScreen` in between. This needs an
explicit unlock — a one-tap "sound on", or piggybacking the unlock on the
join/start tap and holding an unlocked `AudioContext` across the transition.
Also: `?fast=` scales the room clock, so anything timed to phase length must read
`Clock.totalMs`, not `PHASE_DURATIONS`.

### 2.5 Prediction scoring — medium, gated on a rule

The role holder guesses which answer wins while everyone votes, and scores for
guessing right — so setting the round up is not worth zero.

The slot is nearly free: `predictions: Record<PlayerId, EntryId>` beside
`round.ballots`, ~10 bytes per player against the 64KB budget.

**[ADR 0006](./adr/0006-a-ballot-is-a-draft-until-it-is-locked.md) does not
foreclose it — it prescribes the shape.** Its closing line is the instruction:
*"Draft locally, commit once."* So hold the prediction in `VoteScreen` local
state beside the rank draft and commit it as a widened `round/ballotCast`
payload, not as its own action. A separate action repeats exactly what that ADR
rejected — "a second action, a second guard, a second thing to project and
order… to carry state nobody outside the tapping browser is allowed to see
anyway."

Two things needing care:

- **A new redaction rule.** Predictions are secret until the reveal, so
  `project()` needs per-viewer stripping — the same shape it already uses for
  `authorId`. `redactTiebreak` is the cautionary tale: it exists because a
  redaction leaked by a second route. `RoundResult` needs the same audit if
  predictions ever land in `history`.
- **`settleGates` must decide** whether a voter who ranked but did not predict
  counts as done, or the room can tally with predictions missing.

**The blocking question is not technical.** The role holder votes but cannot
score — *"Does not compete. Sets the round up, sits it out, then votes."* A
prediction lets them score, which breaks that rule. Options: predict and score
(breaks it, but makes sitting out less dead), predict and do not score
(pointless), or do not predict (asymmetric UI). Decide before any code. Bots need
a prediction too, and per §2.1 must not be able to strand the vote gate.

### 2.6 Recap — large, and not the job it looks like

An end-of-game review of every round's captions, GIFs and authors.

**There is nothing to render.** `history` keeps ids and points only:

```ts
export interface RoundResult {
  round: number
  winnerEntryId: EntryId
  points: Readonly<Record<PlayerId, number>>
  ranking: readonly EntryId[]
  authorOf: Readonly<Record<EntryId, PlayerId>>
}
```

No captions, no `MediaRef`, no subject. `Round` is replaced wholesale by
`beginRound()` and set to `null` entering `podium`, so `winnerEntryId` and
`ranking` are strings like `r3-e2` pointing at a round that no longer exists.
[ADR 0011](./adr/0011-a-quote-is-a-copy-and-a-glyph-is-a-location.md) already
established this and solved it for chat by making a quote a **copy**. That is the
precedent: snapshot the content, do not reference it.

**So this is a data-retention job with a byte budget to defend.** The 64KB Ably
cap is the first stated invariant in `lib/game/types.ts`. Every `rev` bump
re-broadcasts the whole state, so retention is paid on every action for the rest
of the game, not once at the end.

| Shape | Cost at 10 rounds × 19 competitors | Verdict |
| --- | --- | --- |
| **Winner only** — add `winner?: { answer, subject }` to `RoundResult` | ~4KB | The obvious first cut, and what a "best of" reel needs |
| Top three per round | ~12KB | Tight but probably fine |
| Every entry | ~38KB+ | Does not fit. Would need a second store beside `RoomStore` (the `lib/room/events.ts` precedent) or client-local accumulation, which loses it for anyone who joined late or reloaded |

One opening: `lib/export/` already renders a captioned meme in the browser, and
the roadmap defers "the highlight reel" only because it needs a destination of
ours. **A recap that plays in the room rather than exporting sidesteps that.**

---

## 3 — Suggested order

A reading of the list, not a schedule. The defects, §2.1 and §2.2 are done;
what is left:

1. **1.6** — the ballot leak. Small, and the only thing left here that is a
   correctness question rather than a feature.
2. Everything else in §2 is optional. **Do not start 2.6 casually** — it reads
   like a screen and is a wire-format change with a byte budget to defend.

The launch gate's credential rows are settled: the keys are sourced locally
from `.env` files and from Vercel's store.

Everything else is optional. **Do not start 2.6 casually** — it reads like a
screen and is a wire-format change with a byte budget to defend.

---

## Working notes

- `npm run verify` passes on `main` — 452 tests across 30 files. If it fails
  locally, delete `.next` first: a stale build from another branch produces
  phantom `validator.ts` type errors that look like real breakage.
- Each defect above names the file to read. **Confirm it before fixing it** —
  two reported items did not reproduce as described, and one of those was flagged
  by a pass that had researched a stale checkout.
