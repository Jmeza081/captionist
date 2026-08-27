import { FIXTURE_PHASES } from '@/lib/game/fixtures'
import type { RoomPhase } from '@/lib/game/types'

/**
 * The four URL levers, read once in `RoomProvider`.
 *
 * Gated to non-production so no test branch can leak into a screen: in a
 * production build every lever reads as absent, whatever the query string says.
 *
 * `?fast` rather than Playwright's `page.clock.install()`: clock faking is
 * per-page, and with a host in one page and guests in others it desynchronises
 * the room — the one thing the whole clock design exists to prevent.
 */
export interface Levers {
  seed?: number
  bots?: number
  fast?: number
  phase?: RoomPhase
}

const MAX_BOTS = 19

export function readLevers(
  search: URLSearchParams,
  enabled: boolean = process.env.NODE_ENV !== 'production',
): Levers {
  if (!enabled) return {}

  const levers: Levers = {}

  const seed = Number(search.get('seed'))
  if (Number.isFinite(seed) && search.get('seed') !== null) levers.seed = seed

  const bots = Number(search.get('bots'))
  if (Number.isInteger(bots) && bots > 0) levers.bots = Math.min(bots, MAX_BOTS)

  const fast = Number(search.get('fast'))
  if (Number.isFinite(fast) && fast > 0) levers.fast = fast

  const phase = search.get('phase')
  if (phase && (FIXTURE_PHASES as readonly string[]).includes(phase)) {
    levers.phase = phase as RoomPhase
  }

  return levers
}
