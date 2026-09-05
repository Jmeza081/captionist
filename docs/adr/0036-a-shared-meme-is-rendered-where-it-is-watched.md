# 0036 — A shared meme is rendered where it is watched

**Status:** accepted · 2026-09-05

## Context

A room's best moments died with the tab. The winning caption, the card
everyone argued over, the standings — none of it could leave the room except
as a phone screenshot. The design drew one export control, on the podium
(`Download the highlight reel` / `Post to Slack`), and
[architecture.md](../architecture.md#not-yet-built) had recorded why it was
not built: the OS share sheet takes a *link* to a destination the browser
already owns, and a reel or a Slack post needs a destination *of ours*. That
argument dies the moment the thing shared is a **file**. `navigator.share`
takes files on every phone; the clipboard takes a PNG on every laptop; a
download works everywhere. None of them needs a server.

What made this an ADR rather than a feature is whose picture it is. Both
providers' terms forbid proxying the API, caching or re-hosting the media, and
altering the URLs ([ADR 0020](./0020-giphy-is-called-from-the-browser.md),
[ADR 0022](./0022-the-gif-provider-is-a-seam.md),
[ADR 0025](./0025-the-app-remembers-slugs-not-urls.md)). Klipy's, read in full
on 2026-09-05 (`klipy.com/support/api-terms`,
`docs.klipy.com/integration-requirements`, `docs.klipy.com/attribution`,
`klipy.com/support/terms-services`), say four more things that matter here:

- The API licence exists "to permit the users of your Applications to access,
  select, and **post** GIFs". The general terms give the user a licence "to
  transmit a copy of the Content to recipients of your messages … solely for
  your personal and non-commercial purposes". Posting elsewhere is the point.
- The attribution guidelines contemplate exactly this surface: "Display a
  KLIPY watermark on the **shared content message card** — OPTIONAL".
- The Register Share signal is to be sent "when a user selects a GIF" — which
  `reportPick()` already does at pick time.
- The general terms also say a user "shall not copy, modify, publish … or
  otherwise exploit any content for commercial purposes". A caption over a
  frame is a modification. It is the end user's, for a personal message, and
  Klipy itself ships a Memes API — but no clause names it, and that is the
  residual risk.

## Decision

**The meme is re-encoded in the browser that is watching it, with the
provider's mark burned in, and nothing is kept.**

1. **Client-side, end to end.** `lib/export/` fetches the GIF from the
   provider's CDN — both send `access-control-allow-origin: *`, verified — and
   decodes it (`gifuct-js`, one frame at a time, honouring the file's own
   disposal rules), composes each frame with the caption in `MediaCard`'s own
   type, and re-encodes it (`gifenc`, one global palette built from a sample of
   *composed* frames). The `Blob` goes to the share sheet, the clipboard or a
   download. No route, no cache, no store, no second host. The URL in game
   state is fetched verbatim; nothing derives an mp4 or a still from it.
2. **The mark is inside the image.** `providerOf(src)` decides whose picture it
   is — the rule chat already uses — and the footer says `Powered by KLIPY` or
   `Powered by Giphy`. The offline shelf is credited to nobody, as
   [ADR 0020](./0020-giphy-is-called-from-the-browser.md) requires.
3. **No second share signal.** The pick already registered one; an export is
   the same GIF leaving by another door.
4. **Behind a flag that flips without a deploy.** `export-media` is a Vercel
   Flag read through the Flags SDK in `flags.ts`, evaluated per request in
   `app/room/[code]/page.tsx` and handed down as a prop. A Vercel environment
   variable needs a redeploy to take effect, and the case this guards is "a
   rights holder asked us to stop", where the answer has to be minutes. Until a
   Vercel project exists — there is none yet — the SDK returns `defaultValue`,
   which is on unless `EXPORT_MEDIA=off`; `?export=off` is a thirteenth URL lever
   that can only ever take the keys away. And a note goes to
   `developers@klipy.com` before launch, which the Integration Requirements ask
   for from any "custom implementation".

Four smaller calls, each the design's rule applied to a file:

- **Natural ratio, no crop.** `mediaAspect()`'s 4:5 → 4:3 band exists so a
  *grid* reads as rows. A file has no neighbours, and `cover` on a 16:9 clip
  would ship three quarters of the joke.
- **The label is the device's, not the artefact's**
  ([ADR 0033](./0033-a-device-capability-decides-the-label.md) applied to
  files): "Share GIF" where `canShare({ files })` is true, "Save GIF"
  otherwise; "Share image" / "Copy image" / "Save image" for the standings. The
  server snapshot is `false`, so the first paint wears the laptop's word.
- **The count is the blocked label**
  ([ADR 0032](./0032-a-blocked-label-counts-what-is-missing.md)): "Rendering 12
  of 60…" on a key that stays live.
- **One key per artefact.** No "Copy still" beside "Save GIF": the artefact is
  the animation, the vote foot already holds four peers at 44px, and the thing
  most likely to be *pasted* — the standings — already copies a PNG.

And one that is a browser's rule rather than ours: `navigator.share` must run
inside the tap's activation window, and a long re-encode does not fit in one.
So the reveal pre-renders its one card at idle, and everywhere else a sheet
that refuses a stale gesture is reported as `expired` — the file is kept, the
label turns to "Send GIF", one more tap sends it. The clipboard's
`ClipboardItem` is constructed synchronously in the click with a promise for
the bytes, which is what Safari requires.

## Consequences

**Colour tokens are custom properties now.** `theme/_css-vars.scss` published
only spacing, radii and the rail widths; a canvas reads no stylesheet, so the
handful of colours an export paints with, the four caption type steps and the
three hat numbers are published too. One source of truth, read back off
`:root` — `paint()` throws on an empty one rather than shipping white on
nothing.

**`MediaCard` has a fifth foot peer**, `share`, first in the row, and the foot
gap went from ten to twelve: two 32px pills each grow a 44px touch area, and
ten between their boxes left the grown areas overlapping.

**`gifenc` ships no types**; `types/gifenc.d.ts` declares the slice that is
called. Both libraries are dormant because GIF89a is finished; both are pinned
exactly and reached only through dynamic `import()` from `lib/export/`, so an
off flag ships no encoder.

**The suite exercises the one-frame road only.** It blocks every host but
loopback and the shelf is SVG, so `frames.ts`'s `<img>` fallback is what every
spec runs through. The decode was checked by hand against a live Klipy round:
a 14-frame 220px GIF re-encoded in ~200ms on a laptop. The threshold for
moving `encode.ts` to a Worker is a measured frame over ~50ms on a phone or a
100-frame export over ~8s; compose stays on the main thread because a Worker
has no `document.fonts`.

**`prefers-reduced-motion` does not still the export.** It governs the page;
the export is a file the user asked for.

**Superseded in part:** the "needs a destination of ours" paragraph in
[architecture.md](../architecture.md#not-yet-built). What still needs one is
only the *reel* and posting on the room's behalf.
