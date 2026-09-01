# 0028 — The room speaks in its own lane

**Status:** accepted · 2026-09-01

## Context

`ChatMessage` has had an `announcement` prop since phase 2 — an accent card that
takes the avatar gutter, drawn for "the room speaking, not a player". Nothing
set it. Its own doc comment said why:

> An announcement is a thing you *do*, and until there is an action for it this
> prop is the gallery's and a future feature's.

Playtesting produced the action. When the host changes the game mode — from the
lobby's segmented control before the game starts, or the toolbox mid-round —
`LobbyScreen` and `RoomShell` each fired a local `notify()` toast. The host saw
it. **Nobody else did.** The rest of the room found out when the next round
opened and the screen was a different shape: no image from the Prompter, a text
field where a GIF board had been.

The same silence covers a player dropping. Presence already produced
`player/left`, and [ADR 0029](./0029-a-held-seat-does-not-hold-the-round.md)
makes the round stop waiting on them — so the submission count now visibly falls
mid-phase with nothing to explain it.

## Decision

**An announcement is a third `RoomEvent` kind, published by the host engine, and
it carries a code rather than a sentence.**

```ts
export type AnnouncementBody =
  | { code: 'mode'; mode: GameMode }
  | { code: 'left'; who: PlayerId }
  | { code: 'returned'; who: PlayerId }
```

Four things follow from that, and each was a real fork.

### It crosses the wire rather than being derived per tab

Every tab already receives the state change, so each could diff its own
snapshots and synthesize the line locally — no wire, no trust problem. It loses
on three counts.

**State is a projection, not a log.** The host broadcasts `project(state, id)`
per revision and `GuestClient` drops anything at or below the `rev` it last
applied. Nothing replays. A guest joining at round three has no predecessor to
diff against; an Ably client that loses continuity past two minutes gets one
fresh snapshot with several changes collapsed into it, and would synthesize
lines for transitions it never saw — or miss them entirely. Two tabs would hold
different logs of the same room, which is worse than no log.

**It would need a second writer.** [ADR 0010](./0010-chat-is-a-second-store-and-its-sender-is-stamped.md)
made `isMember` a *predicate* precisely so the event store holds no copy of game
state. A diff-derived line needs the store subscribed to `RoomStore`, or a
component writing into it — a path into the log that is not `receive(event)`.

**And ordering.** A wire announcement carries the host's `at`, the same clock
the room's deadlines are on. A locally-derived one is stamped when each tab
noticed, so a throttled background tab interleaves it against chat differently
from its neighbour.

### The words are the client's, the wire's is a code

A rendered sentence on this lane would be sender-supplied text — exactly what
the 140-character cap and the attachment allowlist on the chat lane exist to
distrust. A code needs no cap, because there is nothing to truncate.

It also keeps copy where every other string lives, and lets the log resolve a
name through the roster the way a chat author's is resolved — so somebody who
changed their nickname is not announced under the old one, and the line can say
"You're back." to the person it is about.

### It is emitted from `HostEngine`, off the transition

Not from the two screens that switch modes. A screen fires even when the host's
action is *refused*; no screen fires at all for a drop, because nobody taps for
one; and under `?as=` the tab that taps is not the host, so the event would be
stamped with a guest's id.

`HostEngine.commit()` is where every accepted transition passes — an intent, the
host's own action, a clock expiring — so `roomAnnouncements(before, after)`
compares the two states there. One rule covers every road: the lobby's
`room/settingsChanged` and the toolbox's `host/switchedMode` are the same fact
told twice, and a per-action emit would have needed a branch each and grown a
third the next time somebody added a road.

Ordering inside `commit` is load-bearing: `publish()` runs **before** the
announcement, so every tab holds the state a line describes before the line
arrives. A name landing ahead of the roster renders "Someone" for somebody
sitting right there.

**A join gets no line.** The roster already draws it, and twenty of them while a
room fills is noise over the screen that exists to show exactly that.

### The guard is `isRoomHost`, not the rate limit

`CHAT_INTERVAL_MS` bounds a *member* flooding the log at will. The host emits
one line per accepted state transition, and the reducer is what bounds those —
so running announcements through the chat limiter would be a bug, not a
safeguard: a wifi router dying drops three players inside one presence sweep,
three legitimate facts, and the limiter would silently eat two of them at the
moment the log most needs to be right.

What replaces it is the guard that actually matters. Without one, any member can
publish `kind: 'announcement'` and every browser renders it as the room
speaking. A member typing "New mode: …" into chat is a joke; the same words on
the room's own accent card are a lie the room told. So `EventStoreOptions` gains
`isRoomHost`, a predicate over `state.hostId` for the same reason `isMember` is
one. Plus a consecutive-duplicate collapse — one comparison against the newest
entry, which absorbs a host republishing after an Ably resume without inventing
a timestamp anybody could disagree about.

`CHAT_HISTORY` still applies: a line takes a slot like any other.

### The face is the room's, and the `· host` suffix is gone

`ChatMessage`'s announcement branch draws no `Avatar`; it reads `author.name`
for the eyebrow. Passing the host's props would be wrong twice — it re-creates
the "HOST · HOST" eyebrow the prop's own note rejects, and on a drop it credits
the host with unplugging somebody else's router. So `ROOM_FACE` is a constant
named "Room", and the eyebrow prints the speaker's name and nothing else. The
old `· host` suffix marked a *host's chat line*, which is the exact reading
[ADR 0004](./0004-the-host-is-not-a-special-case.md) rejects.

## Consequences

- `ChatEntry` gains `kind: 'chat'` and a sibling `AnnouncementEntry`, unioned as
  `LogEntry`. A discriminator rather than optional fields on one interface,
  which would have invited `entry.text` on a thing that has none. `useChatLog()`
  returns `LogEntry[]`; `isChat` narrows it.
- **Announcements toast, and count as unread.** A collapsed rail is exactly how
  somebody misses a mode switch, so `ChatToast` gained an `announcement` prop
  with the same accent treatment and no face. Keying `mine` off the sender the
  way chat does would have exempted the host's own tab from every drop line.
- The two `notify()` toasts stay. They are the *asker's* confirmation that their
  tap landed; the announcement is the *room's* record. Neither publishes.
- Under `BroadcastTransport` a guest still cannot verify a sender at all. That
  is the pre-existing limitation ADR 0010 records, not a new one — `isRoomHost`
  is exactly as strong as the transport's stamping underneath it.
