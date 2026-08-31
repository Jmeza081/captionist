import { FIXTURE_PHASES } from '@/lib/game/fixtures'
import type { GameMode, PlayerId, RoomPhase, RoomSettings } from '@/lib/game/types'

/**
 * The eleven URL levers, read once in `RoomProvider`.
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
  /**
   * Which mode a fixture boots in. Without it the reversed lane's screens
   * cannot be reached at all: every fixture takes `DEFAULT_SETTINGS.mode`.
   */
  mode?: GameMode
  /**
   * The room's voting rule and caption format, for the same reason as `mode`:
   * every fixture takes `DEFAULT_SETTINGS`, so a single-vote or one-line room
   * is otherwise reachable only by walking `/host` → `sessionStorage` → a
   * room, which drags a route boundary into a screen spec.
   */
  voting?: RoomSettings['voting']
  format?: RoomSettings['format']
  /**
   * Who the local player is. Defaults to the host.
   *
   * The round-1 role holder is `players[0]`, which is also the host — so as
   * the host you are always the one setting the round up, and the caption and
   * answer faces are unreachable. `?as=p2` sits you in someone else's seat,
   * which is also the first real exercise of the guest path before phase 4
   * has to depend on it.
   */
  as?: PlayerId
  /**
   * How many competitors a `?phase=waiting` fixture leaves outstanding.
   *
   * Every fixture submits everybody, so the tracker always reads N of N and
   * the face that still offers the host a button — a wait with someone left in
   * it — is otherwise unreachable. See `FixtureOptions.out`.
   */
  out?: number
  /**
   * Serve offline placeholder art instead of calling Giphy. Keeps a long
   * afternoon of layout work off the rate limit.
   */
  gifs?: 'stub' | 'live'
  /**
   * Which transport the room runs on.
   *
   * A real room is Ably — that is the only way two devices reach each other,
   * and unlike Giphy there is no offline stand-in for other people. But the
   * test suite must not need a key or a network, so `broadcast` selects the
   * one-browser transport instead. `ABLY_STUB=1` does the same thing stickily.
   */
  transport?: 'ably' | 'broadcast'
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

  const mode = search.get('mode')
  if (mode === 'caption' || mode === 'react') levers.mode = mode

  const voting = search.get('voting')
  if (voting === 'rank' || voting === 'single') levers.voting = voting

  const format = search.get('format')
  if (format === 'tb' || format === 'one') levers.format = format

  // Shape only — whether that seat exists is the room's business, not the
  // parser's, and a fixture with fewer players should fall back rather than throw.
  const as = search.get('as')
  if (as && /^p\d+$/.test(as)) levers.as = as

  const out = Number(search.get('out'))
  if (Number.isInteger(out) && out > 0) levers.out = out

  const gifs = search.get('gifs')
  if (gifs === 'stub' || gifs === 'live') levers.gifs = gifs

  const transport = search.get('transport')
  if (transport === 'ably' || transport === 'broadcast') levers.transport = transport

  return levers
}
