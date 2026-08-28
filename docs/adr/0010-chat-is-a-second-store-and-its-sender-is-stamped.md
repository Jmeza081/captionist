# 0010 — Chat is a second store, and its sender is stamped

**Status:** accepted · 2026-08-27

## Context

[ADR 0003](./0003-host-authority-over-a-swappable-transport.md) cut three lanes
through `RoomTransport`: state, intents, and events. The event lane was written
in phase 1 with both of its kinds already declared — `chat` and `reaction` —
and carried nothing until phase 6. The comment above it said why it existed
early: so that filling it later would not reshape the interface.

That held. Filling it surfaced two questions the empty lane had not had to
answer.

**Where does a message live?** `RoomStore` is the obvious home and the wrong
one. The host broadcasts a projection of the whole room on every revision, so
routing chat through state would cost a full per-recipient fan-out per message.
Worse, `rev` is the monotonic token guests drop stale updates against
(`GuestClient.receive`): chatter would advance the number that decides whether a
*game* update is worth applying. A message would also enter the reducer, which
has no opinion about any of it.

**Who is a message from?** The intent lane already answered this. `Intent.from`
is stamped by the transport from the identity it authenticated — Ably's
`message.clientId`, issued by the token endpoint; a roster token under
`BroadcastTransport`. The comment on that line is explicit that a sender must
not be able to claim to be somebody else.

The event lane did neither. `AblyTransport` passed `RoomEvent` straight through
from the payload, and `BroadcastTransport` checked a membership token on an
intent and nothing at all on an event. While nothing published events this was
invisible. The first thing chat would otherwise have bought the room is the
ability to post as anyone in it, and to react as them.

## Decision

**Chat and reactions live in `lib/room/events.ts`, a store beside `RoomStore`
rather than inside it.** Same two constraints as the room's store — a stable
snapshot reference between real changes, nothing time-varying in the snapshot —
because both are read through `useSyncExternalStore` and React 19 loops on
either violation. `RoomProvider` builds it, `transport.onEvent` feeds it, and
`useChatLog` / `useTallies` / `useUnread` read it. It never touches `rev`.

**All three transports stamp `from` on receive**, matching the intent lane.
Ably takes it from `message.clientId`; `BroadcastTransport` carries `from` and
the roster token on the wire and the host refuses a mismatch; `LocalTransport`
stamps its endpoint's own seat. The sender's own local echo is stamped too, so
every copy of a message is the same object.

**Every other guard is on receive, not on send.** Membership (drop anyone not
in `state.players`), one message per sender per 1.5s measured on the *local*
clock, and truncation at 140 characters. A throttle in the composer binds only
a tab that agreed to run it, which is every tab except the one worth
throttling; and a limit that read the event's own `at` would be walked straight
through by a sender stamping its messages an interval apart.

**The reaction kind widened rather than forking.** `target: 'entry' |
'message'` with a `targetId`, not a third kind — reacting to a card and
reacting to a message are the same act against different things, and they share
a handler, a tally derivation and a rate limit.

## Consequences

A message costs one small publish and no state broadcast, and a room that is
talking does not make the game's ordering token move.

The two stores can disagree for an instant — a message can arrive from someone
whose `player/left` has not been applied yet. That is correct: the room heard
them. `ChatPanel` renders a message whose author is no longer in `state.players`
without a face rather than dropping it.

**Under `BroadcastTransport` a guest still cannot verify a sender**, because
only the host holds the roster. That is not new and not hidden: the file has
said since phase 4 that same-origin tabs are not a security boundary and that
real enforcement arrives with Ably. The membership check in the event store is
what holds on both, and it is the reason it lives there rather than in a
transport.

Chat history is 50 messages, in memory, per tab. There is no database and the
room dies with its host, so anything more would promise persistence the
architecture cannot keep.

No host mute. Three to twenty coworkers in a room they were invited to are
socially moderated, and half a moderation tool is worse than none — if it is
ever needed, it is a `RoomEvent` the host publishes and every client honours,
not game state.
