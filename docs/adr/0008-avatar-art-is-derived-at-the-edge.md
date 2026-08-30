# 0008 — Avatar art is derived at the edge

**Status:** accepted · 2026-08-27 · amended 2026-08-28 (see *Amendment*)

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
`lib/avatar.ts` turns a seed into a DiceBear `critters` face, memoised per seed
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

## Amendment · 2026-08-28 — the style, and what changing it cost

The decision above is unchanged: the seed travels, the art is derived locally,
and it is drawn as `<img src>`. What changed is the style, and the move was not
the one-constant edit the last consequence below promised.

**`funEmoji` became `critters`,** because the catalogue grew from seven faces to
sixty-four and seven flat emoji faces do not stay tellable apart sixty-four
times. Critters is combinatorial — bodies, eyes, mouths, hats, patterns and two
palettes — which is what makes a catalogue that size readable at all. CC0 1.0,
so attribution is not a constraint on where it appears.

**It forced a major version.** Critters exists only in DiceBear 10, and there is
no version 10 of `@dicebear/collection`. So the dependency became
`@dicebear/core@10` plus `@dicebear/styles`, a style is now a JSON definition
rather than a module, and `createAvatar(style, options)` became
`new Avatar(new Style(definition), options)`. Two option values moved with it:

- **`backgroundColor: 'transparent'` is now `'00000000'`.** Version 10 validates
  colours as hex and rejects the CSS keywords its predecessor took. This one is
  load-bearing rather than cosmetic — critters paints an opaque background by
  default, so getting it wrong covers every player's seat colour.
- **`animationVariant` is pinned to `'none'`.** Critters is an animated style.
  Its moving variants carry `weight: 0` upstream today, so `none` already wins
  — but that is a value in a third party's JSON, and a patch release that
  flipped one to `1` would set every avatar in the app moving with no build
  failure to catch it. Which is this ADR's own last consequence, so it is now
  guarded rather than merely noted: `lib/avatar.test.ts` asserts both the
  transparent background and the absent animation.

**The measured cost.** Version 10 ships ~420KB of JavaScript against version 9's
~52KB, three quarters of it compiled Ajv schema validators that `Style`'s
constructor calls and so cannot be shaken out. They do reach the browser. The
chunk carrying them is 217KB raw and **34KB gzipped**, and total client
JavaScript moved from 1368KB to 1370KB raw — the validators compress extremely
well, and that number is the reason art is still a data URI rather than a file
under `public/`. If it ever stops being true, the escape hatch is the one this
ADR already describes: `Player.src` wins over `avatarSeed`, so committed SVGs
served same-origin are a change to one function.

## Amendment · 2026-08-30 — the catalogue is sized to the window

The amendment above tied the style to the catalogue: seven flat emoji faces do
not stay tellable apart sixty-four times, so `critters` replaced `funEmoji`.
That argument is unchanged. The number moved.

**The picker offers ten faces now, not eight**, because eight is one short of a
useful set for a game whose lobby holds twenty — the offer should not be the
thing that makes two people pick the same face.

**So the catalogue is seventy, not sixty-four.** `avatarPage` slices fixed
windows, so a catalogue that is not a whole number of them ends in a short page
— a picker offering four faces because of arithmetic nobody chose. The window
is the number that gets designed; the catalogue follows it. Widening it
appended six seeds rather than leaving the last page ragged, and
`lib/avatar.test.ts` holds the pair to `length % AVATAR_WINDOW === 0` so the
next change to either has to bring the other with it.

**Appended, never reordered or renamed.** A seed's index decides which page it
falls on and which colour it previews against; it never decides which face it
draws. So growing the catalogue moves faces between pages and orphans nobody's
stored pick, while reordering or renaming one would quietly change the face
somebody chose. The original seven still hold indices 0–6, which is still what
keeps every pre-catalogue `localStorage` value on page 0.

**One layout consequence, and it was a layout bug wearing a picker's clothes.**
Ten tiles at the design's 46px with a 10px gap need 550px to hold one line, and
the card measured 484px at 1440 and 420px at 1280 — so the first answer here
was a fixed five-column grid at every width. That was treating the symptom. The
card is 600px by design and its inner width is 548px; it was only ever narrower
because both front doors split the page `40fr 60fr` at `xl`, and 40% of 1280 is
512px. A fraction squeezes the one width in that layout the design actually
states.

So the form column is sized to the card it carries and the wall takes what is
left, and `AvatarPicker` asks a **container query** rather than a breakpoint —
whether ten faces fit is a question about the column it was dropped into, not
about the window. Ten on one line at every width either front door is drawn at,
five-and-five on a phone, and the gap goes 10px → 8px because at 10px the row
needs 550 and the card has 548, which is the whole of the difference. The tile
keeps the design's 46px and the 44px touch floor is untouched.
