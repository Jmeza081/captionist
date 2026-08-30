import { Avatar, Style } from '@dicebear/core'
import definition from '@dicebear/styles/critters.json' with { type: 'json' }
import { colorFor } from '@/lib/game/constants'

/**
 * A seed, turned into a face.
 *
 * **The art is derived, never stored.** `GameState` carries `avatarSeed` and
 * nothing else — see the no-data-URI invariant at the top of
 * `lib/game/types.ts`, which exists because twenty inlined avatars would
 * exhaust Ably's 64KB message cap on their own. So every client renders the
 * same seed into the same face locally, and the wire carries a word.
 *
 * Rendered into an `<img src>` rather than injected as inline SVG. The seed
 * travels *from other players*, so it is not ours to trust; an `<img>` is a
 * passive context where an SVG cannot run script, and `dangerouslySetInnerHTML`
 * is not.
 *
 * Recorded in
 * [ADR 0008](../docs/adr/0008-avatar-art-is-derived-at-the-edge.md).
 */

/**
 * `critters` because seventy faces have to stay tellable apart at 26px —
 * the smallest the app draws one — and this is the style with the range to do
 * it: fourteen bodies, nineteen pairs of eyes, nineteen mouths, fifteen hats,
 * ten patterns and a twelve-colour palette apiece for body and accent. Far
 * more combinations than a room will ever ask for, which is the point: the
 * catalogue is drawn from the wide part of that space.
 *
 * CC0 1.0, so nothing about where it appears is constrained by attribution.
 *
 * DiceBear 10 ships a style as a JSON definition rather than a module, and the
 * `Style` is built once here rather than per avatar because that is what the
 * library asks for — this module is imported by a server component, so "once"
 * means once per process, not once per request.
 */
const STYLE = new Style(definition)

/**
 * What every face is drawn with.
 *
 * `backgroundColor` is eight hex digits because DiceBear 10 dropped the CSS
 * colour keywords its predecessor took — `'transparent'` is now a validation
 * error, and `00000000` is the same thing spelled in RGBA. The circle behind
 * the art is the player's seat colour, drawn by `Avatar`, so the face has to
 * sit on it rather than cover it.
 *
 * `animationVariant` is pinned even though it does not have to be. Critters is
 * an animated style, and its five moving variants currently carry `weight: 0`
 * — so `none` already wins on its own. That is a *value in a third party's
 * JSON*, though, and a patch release that flips one to `1` would set every
 * avatar in the app moving with no build failure to catch it. Which is exactly
 * the failure mode ADR 0008 closes with. Motion inside an `<img>` is also
 * motion nobody can stop: an SVG used as an image does not reliably inherit
 * the page's motion preference, which `HeroWall` had to work around the same
 * way. So animation stays something to offer deliberately, behind that
 * preference — never something arrived at by omission.
 */
const OPTIONS = { backgroundColor: ['00000000'], animationVariant: 'none' } as const

/**
 * Generation is pure and deterministic, so the same seed is only ever built
 * once per session. A twenty-player scoreboard would otherwise rebuild every
 * face on every broadcast.
 */
const cache = new Map<string, string>()

export function avatarUri(seed: string): string {
  const hit = cache.get(seed)
  if (hit !== undefined) return hit
  const uri = new Avatar(STYLE, { ...OPTIONS, seed }).toDataUri()
  cache.set(seed, uri)
  return uri
}

/**
 * The faces a player may pick from.
 *
 * Seventy, because the picker shows ten at a time and seventy is seven pages
 * of exactly ten — a catalogue that did not divide would leave a ragged last
 * page to special-case in the layout, the shuffle and every test. The window
 * is the number that gets chosen; the catalogue follows it, which is why this
 * grew by six when the window went from eight to ten rather than the last page
 * being allowed to come up short.
 *
 * All seventy are different drawings rather than seventy names for a
 * handful: no two share even a body, a pair of eyes and a mouth, which
 * `avatar.test.ts` holds to. A seed is a *name*, not a random string, because
 * it has to survive a reload and still mean the same face.
 *
 * **The original seven keep indices 0–6**, and every seed added since keeps
 * the index it was given. A seed's index decides which page it is on and which
 * colour it previews against, but never which face it draws — so growing the
 * catalogue moves faces between pages and orphans nobody, while reordering or
 * renaming one would silently change somebody's stored face. Additions go on
 * the end. `ember`
 * stays first because it is the default a browser with no stored identity
 * gets — `lib/room/identity.ts` and `lib/room/useStoredPerson.ts` both name it
 * as the literal fallback.
 *
 * They live here rather than with the room's identity because they are a
 * property of the art, not of the seat — which is what lets `AvatarPicker` reach
 * for them without a molecule depending on `lib/room/`.
 */
export const AVATAR_SEEDS: readonly string[] = [
  'ember',
  'sunfish',
  'orbit',
  'lagoon',
  'moss',
  'amber',
  'fern',
  'quartz',
  'pebble',
  'cinder',
  'thistle',
  'harbor',
  'marrow',
  'willow',
  'drift',
  'basalt',
  'nettle',
  'copper',
  'gully',
  'tundra',
  'plume',
  'cobble',
  'saffron',
  'birch',
  'monsoon',
  'slate',
  'kelp',
  'juniper',
  'cove',
  'flint',
  'bramble',
  'dune',
  'larch',
  'mica',
  'tidal',
  'sorrel',
  'gale',
  'pumice',
  'heather',
  'cedar',
  'alcove',
  'oxbow',
  'sable',
  'tamarind',
  'glacier',
  'reef',
  'vetch',
  'ochre',
  'cypress',
  'meadow',
  'canyon',
  'gypsum',
  'teasel',
  'marsh',
  'foxglove',
  'cirrus',
  'obsidian',
  'lichen',
  'brindle',
  'estuary',
  'minnow',
  'wren',
  'otter',
  'bracken',
  'sedge',
  'osprey',
  'thicket',
  'inlet',
  'gorse',
  'heron',
]

/** A seed as a person reads it: `sunfish` is announced as "Sunfish". */
export function seedLabel(seed: string): string {
  return seed.charAt(0).toUpperCase() + seed.slice(1)
}

/** How many faces `AvatarPicker` offers at once. Seventy is seven of these. */
export const AVATAR_WINDOW = 10

/**
 * The page of the catalogue a seed sits on.
 *
 * Pure, and that is the point: it is what `AvatarPicker` shows before anybody
 * has shuffled, so the server and the browser derive the same ten faces from
 * the same stored seed and hydration has nothing to disagree about. Drawing
 * the opening window at random would be a mismatch on every load.
 *
 * A seed that is not in the catalogue — one left in `localStorage` by an older
 * build — falls to the first page rather than to an empty one.
 */
export function avatarPage(seed: string, seeds: readonly string[] = AVATAR_SEEDS): readonly string[] {
  const at = seeds.indexOf(seed)
  const page = at < 0 ? 0 : Math.floor(at / AVATAR_WINDOW)
  return seeds.slice(page * AVATAR_WINDOW, (page + 1) * AVATAR_WINDOW)
}

/**
 * The colour behind face `index` in a picker.
 *
 * **A preview, not a promise.** `player/joined` assigns the real seat colour
 * from join order, because a colour has to be stable and unique-ish across a
 * room and only the room can know that. What a player picks is the face.
 */
export function previewColor(index: number): string {
  return colorFor(index)
}
