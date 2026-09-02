# 33. A device capability decides the label, not just the behaviour

Date: 2026-09-02

## Status

Accepted.

## Context

The lobby's share block has always had two keys, and until now both did the
same thing: write the join URL to the clipboard. One of them said "Copy link"
and the other said "Share to Slack", and the snackbar under the second one
finished the sentence — "Link copied — paste it into Slack".

On a laptop that is right. There is nowhere else for a link to go, and the
clipboard genuinely is how it reaches Slack.

On a phone it is the wrong half of the operating system. The OS already owns a
sheet listing Slack, Messages, Mail, AirDrop and everything else installed, and
it will hand the link straight to whichever one you pick. Asking somebody to
copy a link, leave the room, find Slack and paste it is three steps to do what
`navigator.share` does in one — and the third of those steps loses the room,
because the tab that was the lobby is now behind Slack.

So the key should open the sheet where there is one. The question this records
is what happens to the *label*.

## Decision

**A capability check decides the copy, not only the code path.** `useWebShare`
reports `supported`, and the lobby passes `shareLabel={supported ? 'Share
link' : 'Share to Slack'}`. `RoomShare` renders whatever it is handed.

Three consequences follow from that, and each of them is the point rather than
a side effect:

1. **The label is honest on both devices.** "Share to Slack" over an OS sheet
   listing eleven apps is a promise the sheet does not make. "Share link" over
   a clipboard write is a promise the clipboard does not keep either — nothing
   was shared, something was copied, and the person is owed the second half of
   the instruction.

2. **The detection is `useSyncExternalStore`, never `useState` in an effect.**
   The server has no navigator, so a label computed during SSR is a hydration
   mismatch on every phone. The store's server snapshot is `false` — the
   laptop wording — and the client's first commit corrects it, long before
   anybody has read the button. This is the arrangement `useReducedMotion`
   already uses, for the same reason.

3. **A sheet that opened raises no snackbar.** Interaction rule 2 says every
   invisible action confirms, and the whole basis of that rule is that copying
   has no visible result. A share sheet is a full-screen surface the OS just
   put in front of you; confirming it underneath itself is the room telling you
   about the thing covering the room. A cancelled sheet says nothing either —
   `AbortError` is a decision, not a failure, and arguing with it is worse than
   silence.

The write is now awaited, too. The old call was `void
navigator.clipboard?.writeText(...)` followed unconditionally by a snackbar, so
a rejected write still reported success. It reports "Couldn't share the link.
Read the code out instead." now, which is the one thing a person in a room full
of people can always fall back on.

## Consequences

**Every test that touches the share key has to say which device it is.** There
is no longer one right answer, so `e2e/refinements.spec.ts` installs a fake
`navigator.share` for the sheet case and deletes it for the clipboard case,
rather than trusting whatever the runner's Chromium happens to ship. The
clipboard case also has to `grantPermissions(['clipboard-write'])`, because the
write is real now and a rejected one is a visible, different outcome.

**The pattern is available and should stay rare.** Nothing else in the room
branches on a device capability, and most things that look like they want to —
a phone layout, a touch target — are breakpoints and belong in CSS. This is
here because the *capability* differs, not the screen: a small window on a
laptop still has no share sheet, and a tablet at desktop width does.

**`onShareToSlack` is gone.** The prop is `onShare`, because a prop named after
one destination cannot describe a sheet that offers all of them. `RoomShare`
knows nothing about either mechanism; it renders a label and calls a handler,
which is what let this change happen in the screen above it.
