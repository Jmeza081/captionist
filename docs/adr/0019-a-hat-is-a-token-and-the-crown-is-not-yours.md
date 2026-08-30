# 0019 — A hat is a token, and the crown is not yours

**Status:** accepted · 2026-08-30

## Context

Hats are the second thing a player picks about how they look, after the face.
That makes them the first cosmetic added since the model was written, and they
arrive with a property `avatarSeed` does not have: **a hat id becomes a URL.**

A seed is only ever fed to DiceBear, which is why
[ADR 0008](./0008-avatar-art-is-derived-at-the-edge.md) could let an untrusted
string through untouched — the worst a hostile seed does is draw a strange
critter. A hat id names a file. `/media/hats/${id}.svg` with an id chosen by
somebody else's browser is a path built from a stranger's string, and that is
a different class of thing entirely.

The crown adds a second problem. The screen's own copy promises it — *"The
crown goes to whoever is winning; this one is just yours"* — so it is a hat the
room awards rather than one a player owns. It has to beat the chosen hat while
somebody leads, come off when they are overtaken, and be unavailable to anyone
who simply asks for it.

## Decision

**A hat travels as a token and the art is looked up, never built.**

`lib/hats.ts` holds `HAT_ART: Readonly<Record<FaceHat, string>>` — seventeen
literal paths. `hatArt(id)` returns `Object.hasOwn(HAT_ART, id) ? … :
undefined`. There is no code path anywhere that concatenates a string into
`/media/hats/`. `Object.hasOwn` rather than `in` or a bare index is
load-bearing rather than fussy: `'__proto__'`, `'constructor'` and
`'toString'` all resolve through the prototype chain, and
`HAT_ART['constructor']` is a *function*, which stringifies into an `<img src>`
rather than failing.

**The reducer narrows at the door.** `player/joined` runs `asHatId` before the
value reaches `GameState`, so state can hold nothing but the sixteen. Three
independent layers — narrowing on arrival, the closed map at render, and
`Record<HatId, string>` making a missing asset a compile error — and each alone
would be sufficient. That is the point.

**The crown is a hat nobody can pick.** `HAT_IDS` is the sixteen; `FaceHat`
adds `'crown'`. `isHatId` tests the sixteen, so `asHatId('crown')` is
`undefined` and a peer sending `{ hat: 'crown' }` joins bare-headed. The
asymmetry between what `hatArt` knows (seventeen) and what `isHatId` admits
(sixteen) *is* the security property.

**It is resolved in one selector, not stored.** `leaderIds(state)` reads the
folded history; `toAvatarProps(state, player)` returns `crown` for a leader and
the player's own hat for everyone else. `state.players` is never touched, so
losing the lead gives your hat back with nothing to un-store.

**`toAvatarProps` takes `state` as a required argument.** That was the whole
mechanism for finding the eighteen places a face is built: the signature change
turned "did I remember to crown here?" into eighteen compile errors handed over
by the compiler rather than eighteen judgement calls.

## Consequences

- **Nobody leads at 0–0, and a tie for first crowns both.** `standings()` sorts
  by score and then by name, so its first row before anyone has scored is
  whoever is alphabetically first — crowning them would be the scoreboard's
  tiebreak leaking out as a claim about the game. And a crown for the *sole*
  leader blinks out after any round that levels two players, which in a small
  room is most of them; a crown that vanishes reads as a bug where two crowns
  read as a tie.
- **`PlayerRow`'s gold winner row and the crown are different claims.**
  `isWinner` is `rank === 1` — top of *this list* — while the crown is "leads
  on points". They agree once anybody has scored and disagree at 0–0, where the
  row is already gold for a player who has earned nothing. Left alone
  deliberately: folding one onto the other is a change to the scoreboard, not
  to hats.
- **The clip moved inward rather than away.** `.avatar` was `overflow: hidden`,
  which is exactly what crops a perched hat. It now carries `position:
  relative` and a `.clip` child does the clipping, so the circle still clips
  its own art but is no longer what decides whether a hat may sit above the
  rim. Every measurement of a face — the 44px floor in `AvatarPicker`, the
  `boundingBox` assertions in `host.spec.ts` — sees the box it always did.
- **`PlayerFace` is why this was small.** Nine components and five selectors
  had hand-copied the four-field `Pick`; folding them into one alias first made
  the hat a one-line widening instead of a fourteen-file edit. That refactor
  shipped as its own commit for exactly that reason.
- **Faces already wear hats.** The `critters` style draws fifteen of its own,
  so a chosen hat sometimes stacks on one the face came with. Accepted rather
  than pinned off: turning the generator's hats off would restyle all seventy
  faces, changing the face anybody has saved, and `avatar.test.ts` counts the
  hat variant in its distinctness check.
- **Bots and fixtures wear them**, deterministically by seat index. Every
  `?bots=` run and every `?phase=` screen therefore exercises the render path,
  and `?phase=score` is a crown fixture with no setup.
- **A hat is chosen once, at the door.** Both pickers live on the entry
  screens, so changing your hat mid-game means leaving the room — the same
  constraint the face has. Adding it later is a `player/changedHat` action and
  is cheap; it is stated here so it is a decision rather than an accident of
  where the picker was put.
