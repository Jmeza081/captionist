import { funEmoji } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
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
 * `funEmoji` because the design's avatars are flat, friendly faces on a
 * coloured circle, and this is the collection that reads at 26px — the
 * smallest the app draws one.
 */
const STYLE = funEmoji

/**
 * Generation is pure and deterministic, so the same seed is only ever built
 * once per session. A twenty-player scoreboard would otherwise rebuild every
 * face on every broadcast.
 */
const cache = new Map<string, string>()

export function avatarUri(seed: string): string {
  const hit = cache.get(seed)
  if (hit !== undefined) return hit
  const uri = createAvatar(STYLE, {
    seed,
    // The circle behind the art is the player's seat colour, drawn by
    // `Avatar` — the face itself has to sit on it rather than cover it.
    backgroundColor: ['transparent'],
  }).toDataUri()
  cache.set(seed, uri)
  return uri
}

/**
 * The faces a player may pick from.
 *
 * Seven, matching the palette's length so the picker fills a row the design's
 * width. A seed is a *name*, not a random string, because it has to survive a
 * reload and still mean the same face.
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
]

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
