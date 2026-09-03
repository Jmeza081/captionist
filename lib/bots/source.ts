import { readLevers } from '@/lib/room/levers'
import { claudeBrain } from './claude'
import { stubBrain } from './stub'
import type { BotBrain } from './types'

/**
 * Which road a bot's jokes come from.
 *
 * The same three-way switch `lib/gifs/source.ts` resolves, and deliberately
 * the same shape: a URL lever, then the environment, then "no key outside
 * production". Anything that diverges here is a way for the two to disagree
 * about what "stubbed" means.
 */

/** What the URL asked for, if anything. Non-production only, via `readLevers`. */
function lever(): 'stub' | 'live' | undefined {
  if (typeof window === 'undefined') return undefined
  return readLevers(new URLSearchParams(window.location.search)).brain
}

/**
 * The URL lever beats the environment, **in both directions**.
 *
 * `?brain=stub` turns the written-in corpus on and `?brain=live` turns it back
 * off. Both directions on purpose: `?gifs=live` was once a lever that read as
 * understood and did nothing, because the environment variable won
 * unconditionally. `readLevers` is already gated to non-production, so neither
 * direction exists in a deployed build.
 */
export function stubbed(): boolean {
  // **No browser, no route.** The adapter posts to a relative URL and signs
  // itself with a seat out of `sessionStorage`, so a server render or a unit
  // test has nothing to call with. Deciding that here rather than letting the
  // request fail keeps a pointless round trip off a round's clock.
  if (typeof window === 'undefined') return true
  const value = lever()
  if (value) return value === 'stub'
  return process.env.NEXT_PUBLIC_BOTS_STUB === '1'
}

/**
 * The brain to use right now.
 *
 * Resolved per call rather than once per room, because the budget can run out
 * mid-game: `budget.ts` reports spent, and every later turn lands on the
 * written-in corpus without anything being torn down or rebuilt.
 */
export function botBrain(spent = false): BotBrain {
  if (stubbed() || spent) return stubBrain
  return claudeBrain
}
