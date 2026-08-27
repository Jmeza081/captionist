import type { GifResult } from './types'

/**
 * Offline stand-ins for Giphy.
 *
 * Two jobs: keep a long afternoon of layout work off the rate limit, and give
 * CI a picker that behaves identically with no key and no network — the same
 * reasoning as `ComponentGallery/placeholders.ts`.
 *
 * These are URLs, not data URIs. A picked GIF becomes `MediaRef.src` and is
 * broadcast to the room, and `lib/game/types.ts` forbids data URIs in game
 * state because a full-state message has to fit inside Ably's 64KB cap.
 */
const TILES: ReadonlyArray<[slug: string, title: string]> = [
  ['deploy', 'friday deploy'],
  ['merge', 'merge conflict'],
  ['prod', 'prod is down'],
  ['standup', 'standup'],
  ['legacy', 'legacy code'],
  ['oncall', 'on-call at 3am'],
  ['retro', 'the retro'],
  ['migration', 'day four migration'],
  ['rollback', 'the rollback failed'],
  ['postmortem', 'incident postmortem'],
  ['sev1', 'sev-1 energy'],
  ['review', 'code review'],
]

export const SAMPLE_GIFS: readonly GifResult[] = TILES.map(([slug, title]) => ({
  id: `sample-${slug}`,
  src: `/media/stub-${slug}.svg`,
  alt: title,
  keywords: [slug, ...title.split(' ')],
}))

/** A stable pick, so a bot's answer and a seeded test are reproducible. */
export function sampleAt(index: number): GifResult {
  const gif = SAMPLE_GIFS[Math.abs(index) % SAMPLE_GIFS.length]
  // The list is a non-empty literal, so this only satisfies the compiler.
  return gif ?? { id: 'sample', src: '', alt: 'A GIF', keywords: [] }
}
