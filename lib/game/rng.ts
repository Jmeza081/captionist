/**
 * A seeded PRNG, so the reducer can shuffle without calling `Math.random`.
 *
 * The cursor lives in `GameState.seed` and is threaded through every draw:
 * each function returns the next cursor alongside its result. That is what
 * makes a whole game replayable from one number, which in turn is what lets
 * Playwright address a specific vote card by name.
 */

/** One mulberry32 step. Returns the next cursor. */
export function nextSeed(seed: number): number {
  return (seed + 0x6d2b79f5) | 0
}

/** A float in [0, 1) from a cursor, without advancing it. */
export function floatFrom(seed: number): number {
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** An integer in [0, max) plus the next cursor. */
export function nextInt(seed: number, max: number): [number, number] {
  const advanced = nextSeed(seed)
  return [Math.floor(floatFrom(advanced) * max), advanced]
}

/**
 * Fisher-Yates, seeded. Returns the shuffled copy and the next cursor; the
 * input is never mutated.
 */
export function shuffle<T>(items: readonly T[], seed: number): [readonly T[], number] {
  const out = items.slice()
  let cursor = seed
  for (let i = out.length - 1; i > 0; i--) {
    const [j, advanced] = nextInt(cursor, i + 1)
    cursor = advanced
    const a = out[i]
    const b = out[j]
    // The bounds above guarantee both are present; the guard is for `strict`.
    if (a !== undefined && b !== undefined) {
      out[i] = b
      out[j] = a
    }
  }
  return [out, cursor]
}

/** Picks one item and the next cursor. Returns `undefined` for an empty list. */
export function pick<T>(items: readonly T[], seed: number): [T | undefined, number] {
  if (items.length === 0) return [undefined, seed]
  const [i, advanced] = nextInt(seed, items.length)
  return [items[i], advanced]
}
