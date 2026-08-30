# 0018 — A nickname is suggested, not remembered

**Status:** accepted · 2026-08-30

## Context

[ADR 0007](./0007-the-first-tab-to-ask-owns-the-room.md) split who-you-are
across two storages, and `lib/room/identity.ts` still states the rule: the
**person** — nickname and face — is `localStorage`, shared by every tab, so
filling them in once is enough and the next room remembers you; the **seat** is
`sessionStorage`, per tab, because two tabs of one browser are the two players
phase 4 exists to seat.

That reasoning is sound for the seat and for the face. It is wrong for the
nickname, and the way it is wrong only shows up in the case the split was
written for.

Two tabs are how this app is developed, demoed and tested — one host, one
guest, one browser. The seat is per tab, so the room correctly seats two
players. The name is per browser, so both of them are called the same thing.
The roster shows two identical rows, the vote grid shows two identical
attributions, and there is no way to tell whose caption is whose. The one
storage decision that was supposed to make two tabs work is undone by the one
beside it.

It is also friction in the ordinary case. A nickname is a thing nobody wants to
think of on the way into a five-minute game, and the entry screens made it the
only thing standing between a scanned QR code and a seat: the CTA read "Pick a
name first" until you typed something.

## Decision

**The face is remembered. The nickname is suggested.**

`lib/names.ts` generates `Adjective_Noun` from two hand-written lists of
twenty-four words each — 576 pairs, all of them inside the nickname field's
20-character cap, all of them drawn from the subject matter the game is already
about (`Flaky_Deploy`, `Haunted_Runbook`, `Orphaned_Cron`). The joke lands
before the first round does, and two people who draw the same adjective still
differ by noun.

`lib/room/useSuggestedName.ts` mints one per **page load** and holds it, read
through `useSyncExternalStore` for the same reason `useStoredPerson` is: a
random value generated during render is a value the server and the client
disagree about, which is a hydration mismatch. The server snapshot is the empty
string; the client's is one name; React swaps them at hydration without either
side having lied.

`JoinScreen` and `HostSetupScreen` prefill from that instead of from
`useStoredPerson().name`. Nothing else moved: `writeIdentity` still writes the
name on the way into a room, the room still reads it, and both the name and the
face stay editable on the way in.

## Consequences

- **The person is no longer one thing.** `lib/room/identity.ts` still stores
  nickname and face together and `readIdentity` still returns both — what
  changed is that the entry screens read back only one of them. The comment at
  the top of that file describes the storage, not the prefill, and the two now
  differ deliberately. Anyone restoring the name prefill because "the app
  forgets me" should read this ADR first: it forgets on purpose.
- **A new tab is a new player, visibly.** Which is what the storage split
  always intended and never delivered.
- **Both entry screens arrive ready.** With a name in the field the only thing
  that can block the CTA is the room code, so `/join/[code]` — the QR path —
  comes up on a live "Join the room". It is still the same screen and the same
  button: nobody is seated until they press it, and both halves of who they are
  stay theirs to change first.
- **Per page load, not per tab.** A hard load draws again; a client-side hop
  from `/join` to `/host` carries the same suggestion across. This is what the
  module-scope mint buys, and it is the behaviour the field wants — a name that
  changed while you were looking at the face picker would be worse than one
  that is remembered.
- **The word lists are a cap, not just a vocabulary.** `lib/names.test.ts`
  checks every one of the 576 pairs against `NAME_MAX`, because a suggestion
  that arrived already truncated by the field would be a name nobody chose, and
  one long word added by hand later is exactly how that would happen.
- **`DEFAULT_NICKNAME` is now unreferenced.** It was the design artboard's
  placeholder (`TheCaptionist109`) and nothing consumed it; it is left in
  `lib/room/identity.ts` as the design's own record rather than deleted in a
  batch that is about something else.
