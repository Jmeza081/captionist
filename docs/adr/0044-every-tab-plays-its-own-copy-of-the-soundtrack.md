# 0044 — Every tab plays its own copy of the soundtrack

**Status:** accepted · 2026-09-22

## Context

[Backlog §2.4](../backlog.md) asked for background music and per-step sound
effects. Nothing existed: no audio element, no files, no dependency. It named
three constraints — the cue point is an effect on `state.phase`, the preference
is a person's and lives in `localStorage`, and the autoplay policy is the hard
part — and left the shape open.

Two questions decided the shape.

**Who plays the music?** The obvious model is Jackbox's: one shared screen plays
it and the phones stay silent. A room in one physical space would need that,
because ten phones playing one song 20–50ms apart is an echo that no sync can
remove — output latency differs per device and Bluetooth adds 100–300ms the page
cannot measure. But Captionist rooms are **mostly remote**: each person is on a
call, hearing only their own device, and call software's echo cancellation
mostly strips game audio anyway. There is no shared screen to play it from.

**Where do the files come from?** Streaming services need every player to hold
a paid account and forbid use as a game soundtrack; subscription libraries
license video, not redistribution inside an app. CC0 files carry no condition
at all.

## Decision

1. **Every tab plays its own copy, driven by the room's phase.** `useSoundtrack`
   runs in `RoomShell`; `bedFor(phase)` picks the music and `stingFor(from, to)`
   the one-shots. Nothing is sent over the wire — the phase change the room
   already broadcasts is the cue, so every device starts the same file within
   network latency. A clock-driven bed starts at `roomNow − (endsAt − totalMs)`,
   so a reload or a late joiner lands on the same bar. The reducer stays pure.
2. **Silent until the person says otherwise, and the person decides.** The
   preference is `captionist:sound` in `localStorage` — `{ music, sfx, offered }`
   — read through `useSyncExternalStore` with a silent server snapshot, the
   shape of `useReducedMotion`. Never `GameState`: a mute is not the room's, and
   it would bump `rev`.
3. **Unlock inside the tap that leaves for the room.** One `AudioContext` lives
   at module scope in `lib/audio/engine.ts`, so it survives the soft navigation
   from `/join` or `/host`. Their buttons call `unlockAudio()` synchronously
   when sound was already on. The lobby's `SoundOffer` and the toolbox toggles
   unlock in their own taps. After a reload there is no gesture, so the engine
   resumes on the next tap anywhere and the room says so: "Tap anywhere to
   bring the sound back." No key on that snackbar — on a phone the dock is half
   the screen wide and a button there straddled the floating keys, and the tap
   it asked for works wherever it lands.
4. **`starting` before `suspended`.** Every context is born suspended, including
   the ones the browser is about to allow. The engine waits 600ms before
   reporting a suspended context as blocked, or it flashes a refusal at people
   whose browser refused nothing.
5. **Buffers, not media elements.** `<audio loop>` leaves a gap at the loop
   point. `AudioBufferSourceNode` loops sample-accurately and schedules an
   intro and a loop back to back — the podium's fanfare then its ending. Decoded
   buffers are uncompressed (~25MB for the longest bed), so only the bed that is
   playing is kept, plus the sub-two-second stings.
6. **One CC0 chiptune set in `public/audio`**, re-encoded to MP3 because several
   sources were OGG only and Safari will not play OGG, and loudness-normalised
   to −18 LUFS so a crossfade does not lurch. Credits live in `lib/audio/catalog.ts`,
   the toolbox's now-playing line and a fifth step of the licence modal.

## Consequences

- Sync is "same file, same moment", not sample-locked. Fine for a remote room;
  wrong for a room in one physical space, which should keep music on one device
  and mute the rest. Nothing enforces that — it is each person's toggle.
- The E2E suite cannot hear. `RoomShell` publishes `data-sound` (the context's
  state) and `data-sound-playing` (the bed once it is actually sounding) for the
  specs to read. Playwright's Chromium allows autoplay outright and ignores the
  flags that would stop it, so `e2e/sound.spec.ts` imposes the phone policy in
  the page: a context made before any gesture is suspended at birth.
- The jingles for the round opener and the reveal (Kenney NES 00 and 13) were
  chosen without listening. They are one line each in the catalogue.
- Button clicks have no sound. Every button in the app is `Button`, so it would
  be one place to add — but a click sound on every tap is the kind of thing a
  playtest should ask for first.
