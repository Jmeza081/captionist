# 0014 — Uploads are not a feature

**Status:** accepted · 2026-08-28

## Context

Custom image upload has been drawn but blocked since the design landed. The
`Dropzone` molecule was built in full — empty, drag-over and file-ready — and
then only ever rendered `blocked`. `BriefScreen` carried a "Search Giphy /
Upload your own" tab pair whose second tab explained itself instead of working.
`/host` drew a permanently disabled "Allow custom image uploads" toggle with a
reason under it. `MediaRef.source` existed as `'giphy' | 'upload'` purely to
hold the door open.

All of it named the same blocker: nowhere for a player's file to live. That was
recorded as a v1 limitation, which implied the feature was waiting on a storage
target rather than on a decision.

So we priced the storage target. On Vercel Blob, delivery is the only meter that
matters at this app's shape:

| Meter | Per room | Pro includes |
| --- | --- | --- |
| Blob Data Transfer | 3MB GIF × 20 players × 5 rounds ≈ **300MB** | 100 GB/mo |
| Storage (GB-month) | ~15MB, swept | 5 GB |
| Advanced ops (`put`) | 5 | 10,000/mo |

That is roughly **340 rooms a month inside the included tier, and ~1.5¢ per room
after** — cheap in isolation. The cost was never the problem. What the number
buys is the problem:

1. **A vendor and a token** in a project whose stated authority model is "the
   host browser is the server, no database".
2. **A cleanup job.** Vercel Blob has no TTL and no lifecycle rules; ephemerality
   would be a `del()` call plus a cron sweep for the orphans a closed host tab
   leaves behind.
3. **A revocation gap that cannot be closed.** Blobs are CDN-cached up to a month
   by default, a delete takes up to 60s to propagate, and browsers keep serving
   their cached copy regardless. "The image lives only for the game" would be a
   claim we could not actually honour.

The alternative that avoided all three — relaying bytes over the room's own Ably
lane and reassembling to a blob URL per client — fails on its own terms. Ably's
64KB message cap forces either a chunking protocol or a canvas re-encode, and a
re-encode returns frame one of an animated GIF. In a GIF game that is not a
tradeoff. It also needs an addressed event lane for late joiners and reconnects,
which means changing `RoomTransport` — the one interface this codebase was most
deliberate about shaping early, precisely to avoid retrofits of this kind.

## Decision

**Uploads are not a Captionist feature, and the scaffolding for them is removed.**

Giphy already covers the need: the role holder searches it in caption mode, and
players answer with it in react mode. A second image source earns nothing the
first does not already provide.

- `components/molecules/Dropzone/` is deleted.
- `BriefScreen` loses the source tabs; `GifPanel` renders unconditionally.
- The `/host` toggle is **absent, not disabled** — following the precedent the
  caption-format row already sets, where react mode drops the row entirely
  rather than showing a dead control. "Blocked, not disabled" is for an action
  that is unavailable *right now*; it is the wrong shape for one that will never
  be available.
- `MediaRef.source` is dropped rather than narrowed to `'giphy'`. Nothing read
  it, every producer wrote the same literal, and it existed only as the
  discriminator for the removed variant — unread bytes on a wire with a 64KB
  budget.
- `Icon`'s `upload` and `uploadTray` glyphs go with it, leaving the eleven the
  atom's docblock already claimed.

## Consequences

**The code deliberately diverges from the delivered design.**
`design/DESIGNSYSTEM.md` §126 specs the Dropzone, and this repo's rule is that
the design is the source of truth — "if code and design disagree, the code is
the bug." That rule is suspended here by decision, and `design/` is left
untouched rather than edited, because the delivered design is a record of what
was designed, not a mutable file. This ADR is the disagreement's explanation.
Interaction rule 10, "Uploads are first-class — wherever Giphy is offered,
upload is too", is removed from `docs/design-system.md` because it is now false.

**`SegmentedControl`'s `icon` prop is now unused in production.** It stays: it is
design-specified and the component supports it. The gallery case that
demonstrated it was demonstrating the uploader tabs, so it went with them rather
than being kept as fiction — the gallery renders what ships.

**Reversing this is a real project, not a flag.** Nothing is left behind as a
seam. That is the point: a blocked surface implies a promise, and there is no
promise here. `git` has the component if the decision ever changes.

**`Player.src` is untouched.** It is the avatar-side equivalent door and is
likewise unpopulated, but `Avatar` genuinely accepts a resolved `src` and
[ADR 0008](./0008-avatar-art-is-derived-at-the-edge.md) documents the precedence
rule. It is a live prop, not upload scaffolding.
