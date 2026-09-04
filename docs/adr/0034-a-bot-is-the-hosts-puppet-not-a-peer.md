# 0034 — A bot is the host's puppet, not a peer

**Status:** accepted · 2026-09-04

## Context

[ADR 0003](./0003-host-authority-over-a-swappable-transport.md) closes with a
consequence written as a virtue:

> **Bots are indistinguishable from people.** `BotDriver` sends intents through
> the transport rather than calling the reducer, so `?bots=4` exercises
> authorisation, ordering and the host's stamping of `at`. A reducer shortcut
> would have tested none of the code that actually breaks.

That was right while a bot was a test harness. Making bots a feature broke the
premise in two places.

**A bot cannot get an Ably identity.** `/api/ably/token` refuses any seat
without an HMAC the server minted, and `connectAbly` reads a single
per-tab signature out of `sessionStorage`. A bot presenting the host's
signature for seat `p1` is a 403, and if one were ever minted Ably would reject
a `clientId` its token does not bind. So the "indistinguishable" road has only
ever run on `BroadcastTransport` — bots have never crossed a network, and the
consequence above describes something that was never exercised in a real room.

**The round trip is to itself.** A bot lives in the host's tab. Sending its
intent over the transport means host tab → Ably → host tab, to reach an engine
that was already in the room, and costs one billed connection per bot — up to
nineteen.

## Decision

**A bot reaches the engine directly, and reads a projection.**

- `BotPool` calls `engine.apply(action, botId)`. Every rule still applies:
  `authorize` runs, ordering holds, `at` is stamped by the host.
- It observes `project(engine.snapshot(), botId)`, not the snapshot. `project`
  strips `authorId`, so **a bot cannot know who wrote the caption it is
  ranking** — the guarantee is in the type rather than in a rule someone has to
  remember, the same move ADR 0022 made for provider attribution.
- The **pool** acts, not the seat. One model call serves every bot in a phase,
  which is what makes a room cost cents and the only way to ask for lines that
  differ from each other. `BotDriver` is deleted.
- A bot is seated with the **host** as actor. `player/joined` is deliberately
  not host-only and has no phase guard — that openness is what lets a late
  arrival hop in between rounds — so `authorize` now refuses a payload carrying
  `bot` from anyone else.
- `reconcile` **skips bots explicitly**. A bot has no presence entry and never
  will; it survived only via the `everAttached` guard written for fixture
  players, so a later tightening there would have dropped every bot out of
  every phase gate at once. Firing one is `host/botRemoved`, never a drop.

## Consequences

**What is given up is the transport's `from` stamping** — Ably setting
`clientId` from the token. That defends against player A publishing as player
B. It is meaningless for a puppet the host spawned, whose identity the host is
choosing anyway.

**Host-local describes the plumbing, not the visibility.** The host *is* the
server, so everything anyone sees arrives through `publishState()`. A bot in
`state.players` is in that broadcast: its captions reach every vote grid, its
ballots count, its face and hat render on every device. `e2e/bots.spec.ts`
asserts this from a second tab, because no test inside the host's own tab could
tell the difference.

**Bots add no Ably cost.** No connections, no messages, no seat minting.

**The claim ADR 0003 made is narrowed, not deleted.** `?bots=` no longer
exercises the transport. What still exercises it is every other spec, and
`e2e/twotabs.spec.ts` in particular — a real guest in a real second tab, which
is a better test of that path than a bot pretending to be one.
