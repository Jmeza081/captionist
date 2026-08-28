# 0008 — Avatar art is derived at the edge

**Status:** accepted · 2026-08-27

## Context

`Player` has carried `avatarSeed` since the domain model was written, with
`src` beside it marked *"Resolved avatar art. Derived from `avatarSeed`; absent
until resolved."* Nothing resolved it: `@dicebear/core` and
`@dicebear/collection` sat in `package.json` unimported, and every avatar in the
app was a letter on a coloured circle.

Phase 4 gave people a face to pick, so something had to turn a seed into art.
Two constraints decided how.

**Nothing in `GameState` may be a data URI.** Invariant 1 at the top of
`lib/game/types.ts`, and it is not stylistic: a full-state broadcast has to fit
inside Ably's 64KB message cap, and twenty inlined SVGs would exhaust it on
their own. Populating `Player.src` with generated art at join time would have
been the obvious move and would have broken the room at about twelve players.

**A seed is not ours.** `avatarSeed` arrives in state *from other players* —
whatever the joining client put in its `player/joined`. Any rendering path that
treats it as trusted input is treating a stranger's string as trusted input.

## Decision

**The seed travels; the art is rendered locally by whoever displays it.**
`lib/avatar.ts` turns a seed into a DiceBear `funEmoji` face, memoised per seed
because a twenty-player scoreboard would otherwise rebuild every face on every
broadcast. `Avatar` takes `avatarSeed` and resolves it; `toAvatarProps` forwards
it; nothing writes it back into state.

**The art is drawn as `<img src={dataUri}>`, never injected as markup.** An SVG
inside an `<img>` is a passive context — scripts in it do not run.
`dangerouslySetInnerHTML` would render the same bytes in a context where they
do. DiceBear escapes what it builds, so the inline route is *probably* safe
today; "probably safe, given a third party keeps escaping a string a stranger
chose" is not a property worth depending on when the alternative costs nothing.

`Player.src` stays in the type. It is now the door for art that genuinely is a
URL — an uploaded or fetched avatar — and `src` wins over `avatarSeed` when both
are present.

## Consequences

- **The 64KB budget is unchanged.** A seed is a word. What actually goes on the
  wire looks exactly as it did before avatars existed.
- **Every client renders the same seed identically**, because generation is pure
  and deterministic. Two people looking at the same roster see the same faces
  without either of them being told what they look like.
- **The seed list is a property of the art, not of the seat.** `AVATAR_SEEDS`
  and `previewColor` live in `lib/avatar.ts` rather than with the room's
  identity, which is what lets `AvatarPicker` — a molecule — reach for them
  without depending on `lib/room/`.
- **A picked face is not a picked colour.** `player/joined` assigns the seat
  colour from join order, because a colour has to be stable and unique-ish
  across a room and only the room can know that. The picker previews faces on
  the palette; the colour you get depends on when you arrived. This surprises
  people and is still right.
- **DiceBear is now a real dependency.** Swapping the collection restyles every
  avatar in the app from one constant, which is the upside; it also means a
  breaking change in that package is a visual regression rather than a build
  failure, and only a screenshot would catch it.
