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
   * Which shelf a board comes from, and whose.
   *
   * `stub` serves offline placeholder art instead of calling anyone, which
   * keeps a long afternoon of layout work off the rate limit; `live` turns that
   * back off. Naming a provider pins the board to it *and* implies `live`, so
   * both adapters can be exercised in one browser without a rebuild.
   */
  gifs?: 'stub' | 'live' | 'giphy' | 'klipy'
  /**
   * Where a bot's jokes come from.
   *
   * `stub` is the written-in corpus — offline, free and the same every time,
   * which is the road the whole suite takes. `live` calls the model. Named
   * `brain` rather than `bots` because that one is taken by the count.
   */
  brain?: 'stub' | 'live'
  /**
   * Which transport the room runs on.
   *
   * A real room is Ably — that is the only way two devices reach each other,
   * and unlike Giphy there is no offline stand-in for other people. But the
   * test suite must not need a key or a network, so `broadcast` selects the
   * one-browser transport instead. `ABLY_STUB=1` does the same thing stickily.
   */
  transport?: 'ably' | 'broadcast'
  /**
   * This tab is a development guest, letting itself into the room.
   *
   * The number is its position in the queue, which decides how long it waits
   * before joining — see `devGuestDelay`. Carried through `readLevers` so it
   * inherits the same production gate as everything else here: in a deployed
   * build a hand-typed `?auto=` reads as absent.
   */
  auto?: number
  /**
   * How many development guests to open with this room. `/host?guests=3`.
   *
   * The same thing `NEXT_PUBLIC_DEV_GUESTS` does, asked for one room at a time.
   * Worth having both: the environment variable is set-and-forget, and this
   * needs no `.env` edit and no restart — which matters because Turbopack
   * inlines `NEXT_PUBLIC_*` from `.env` files rather than from whatever the
   * shell happened to export, so a variable passed on the command line reaches
   * the server and never the browser.
   */
  guests?: number
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
  if (gifs === 'stub' || gifs === 'live' || gifs === 'giphy' || gifs === 'klipy') {
    levers.gifs = gifs
  }

  const brain = search.get('brain')
  if (brain === 'stub' || brain === 'live') levers.brain = brain

  // `> 0` rather than `>= 0`: zero guests and no guests are the same room, and
  // `Number(null)` is 0 — so a bare `>= 0` would set the lever on every URL
  // that never mentioned it.
  const guests = Number(search.get('guests'))
  if (Number.isInteger(guests) && guests > 0) levers.guests = guests

  // Zero *is* meaningful here — it is the first guest in the queue — so absence
  // has to be tested against the raw parameter rather than the number.
  const rawAuto = search.get('auto')
  const auto = Number(rawAuto)
  if (rawAuto !== null && Number.isInteger(auto) && auto >= 0) levers.auto = auto

  const transport = search.get('transport')
  if (transport === 'ably' || transport === 'broadcast') levers.transport = transport

  return levers
}
