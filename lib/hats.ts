import type { FaceHat, HatId } from './game/types'

/**
 * The hats a player can wear, and the one they cannot.
 *
 * **A hat is a token; the art is a URL.** The same split `avatarSeed` makes,
 * for the same reason — invariant 1 in `lib/game/types.ts`, where a full-state
 * broadcast has to fit inside Ably's 64KB cap. A `HatId` is nine bytes.
 *
 * Zero runtime imports on purpose: `reducer.ts` narrows against this, and the
 * pure game core must not learn to reach `lib/avatar.ts` and DiceBear through
 * it. The `HatId` import is type-only and erases.
 *
 * The art is sixteen committed SVGs served verbatim out of `public/`, which is
 * how `lib/reactions.catalog.ts` already ships emoji. Inlining the path data
 * instead would mean either `dangerouslySetInnerHTML` — the thing ADR 0008
 * rules out, because an `<img>` is a passive context where an SVG cannot run
 * script — or 7KB of identical markup in every render.
 */

/**
 * Not a hat. The room's own, awarded by `leaderIds` and worn only while you
 * lead. It is deliberately outside `HAT_IDS`, so `isHatId` rejects it and a
 * peer who sends `{ hat: 'crown' }` joins bare-headed.
 */
export const CROWN = 'crown'

/**
 * The sixteen, in the order the picker offers them.
 *
 * Order decides which are visible before "Show all hats", so the loud ones
 * lead. Like `AVATAR_SEEDS`, additions go on the end: the order is what a
 * collapsed picker shows, never what a hat *is*.
 */
export const HAT_IDS: readonly HatId[] = [
  'party',
  'propeller',
  'viking',
  'cone',
  'tophat',
  'cowboy',
  'dunce',
  'baseball',
  'captain',
  'beanie',
  'chef',
  'wizard',
  'sombrero',
  'hardhat',
  'grad',
  'bucket',
]

/**
 * Id to file. `Record<FaceHat, string>` rather than a template, so a `HatId`
 * with no art is a compile error and an id is never *interpolated* into a
 * path — it is only ever a key.
 */
const HAT_ART: Readonly<Record<FaceHat, string>> = {
  party: '/media/hats/party.svg',
  propeller: '/media/hats/propeller.svg',
  viking: '/media/hats/viking.svg',
  cone: '/media/hats/cone.svg',
  tophat: '/media/hats/tophat.svg',
  cowboy: '/media/hats/cowboy.svg',
  dunce: '/media/hats/dunce.svg',
  baseball: '/media/hats/baseball.svg',
  captain: '/media/hats/captain.svg',
  beanie: '/media/hats/beanie.svg',
  chef: '/media/hats/chef.svg',
  wizard: '/media/hats/wizard.svg',
  sombrero: '/media/hats/sombrero.svg',
  hardhat: '/media/hats/hardhat.svg',
  grad: '/media/hats/grad.svg',
  bucket: '/media/hats/bucket.svg',
  crown: '/media/hats/crown.svg',
}

/** How a hat is announced. Mirrors each asset's own `<title>`. */
export const HAT_LABELS: Readonly<Record<FaceHat, string>> = {
  party: 'Party hat',
  propeller: 'Propeller beanie',
  viking: 'Viking helmet',
  cone: 'Traffic cone',
  tophat: 'Tiny top hat',
  cowboy: 'Cowboy hat',
  dunce: 'Dunce cap',
  baseball: 'Baseball cap',
  captain: 'Captain’s hat',
  beanie: 'Beanie',
  chef: 'Chef toque',
  wizard: 'Wizard hat',
  sombrero: 'Sombrero',
  hardhat: 'Hard hat',
  grad: 'Graduation cap',
  bucket: 'Bucket hat',
  crown: 'Crown',
}

/**
 * How many the picker offers before "Show all hats".
 *
 * Five, not six, because "No hat" is a tile too: the grid is six across at the
 * width both entry screens give it, and seven tiles is one orphan on a second
 * row. `AvatarPicker`'s docblock is emphatic that ten faces was already "seven
 * rows of faces above the field somebody came here to fill in"; this is the
 * second picker on that same card, so it arrives folded to exactly one row.
 */
export const HAT_WINDOW = 5

/**
 * Below this an avatar wears nothing.
 *
 * At 26px and 30px — chat rows, the round opener, the collapsed rail — a hat
 * is three pixels of colour on a face already fighting for legibility, and the
 * seventy-seed catalogue exists to keep those faces tellable apart.
 */
export const HAT_MIN_SIZE = 34

/**
 * The art for a hat somebody else's browser sent us — or nothing.
 *
 * `Object.hasOwn` rather than `in` or a bare index, and the distinction is
 * load-bearing: `'__proto__'`, `'constructor'` and `'toString'` all resolve
 * through the prototype chain, and `HAT_ART['constructor']` is a *function*,
 * which would stringify into an `<img src>`. Bearing an unknown id costs the
 * hat, never the face.
 */
export function hatArt(id: string | undefined): string | undefined {
  if (id === undefined) return undefined
  return Object.hasOwn(HAT_ART, id) ? HAT_ART[id as FaceHat] : undefined
}

/**
 * Whether a value is a hat a *player* may wear.
 *
 * Tests `HAT_IDS` (sixteen) rather than `HAT_ART` (seventeen), which is what
 * makes the crown unclaimable: the reducer runs this on the way in, so
 * `GameState` can only ever hold one of the sixteen.
 */
export function isHatId(value: unknown): value is HatId {
  return typeof value === 'string' && (HAT_IDS as readonly string[]).includes(value)
}

/** The same check, as a narrowing pass for the wire. */
export function asHatId(value: unknown): HatId | undefined {
  return isHatId(value) ? value : undefined
}
