import type { BoardSource, GifProviderId } from './provider'

/**
 * What this app actually costs a GIF provider, counted as it happens.
 *
 * [ADR 0021](../../docs/adr/0021-the-rooms-limits-are-a-rate-limit.md) sized the
 * whole room by *arithmetic* — floor 45, realistic ~90, ceiling 180 calls for a
 * ten-player five-round `react` game against an allowance of 100 an hour. That
 * model has never been checked against a game anyone played. A production key
 * application wants the measured number, not the modelled one, so this counts.
 *
 * **Why the app counts instead of reading the provider's own header.** Klipy
 * returns `x-ratelimit-limit` and `x-ratelimit-remaining` on every response,
 * which would be strictly better information — and the browser cannot see them.
 * Reading a response header cross-origin needs `Access-Control-Expose-Headers`,
 * and Klipy does not send one; `curl` shows the headers, `fetch` does not. So
 * the count is ours to keep. Verified 2026-08-31.
 *
 * Deliberately **per browser, and never on the wire**. This is not a
 * `RoomEvent`, not game state, and not sent anywhere: it is a local tally the
 * person running the app can read and paste into an application form. A room's
 * true total is the sum across every player's browser, which only the host
 * could assemble — see the note on `usageReport` about what that means for the
 * number you should quote.
 */

/**
 * What a call was for.
 *
 * `share` is the click trigger, which is also a call. `items` is the landing
 * wall, the backdrop and the 404 resolving their slugs — the surfaces a visitor
 * hits before any room exists, and the ones most likely to dominate a quiet
 * hour, so they are counted apart from anything a player did.
 */
export type CallKind = 'trending' | 'search' | 'share' | 'items'

/** How a call ended. A call that failed still cost the allowance. */
export type CallOutcome = 'ok' | 'failed' | 'quota'

const STORAGE_KEY = 'captionist:gif-usage:v1'

/**
 * Fourteen days, then it falls off the back.
 *
 * Long enough to cover a fortnight of playtesting before an application, short
 * enough that the blob stays small and nobody's months-old traffic is sitting
 * in their browser for no reason.
 */
const KEEP_HOURS = 14 * 24

/**
 * A hard ceiling on rows, whatever the window says.
 *
 * `localStorage` is a shared 5MB-ish budget for the whole origin, and this is a
 * diagnostic — it must never be the thing that fills it and breaks the room's
 * own storage. Two providers times 336 hours is the honest worst case; this
 * sits above it and truncates oldest-first regardless.
 */
const MAX_ROWS = 1000

interface Row {
  /** UTC hour, `2026-08-31T18`. The allowance is hourly, so the bucket is too. */
  hour: string
  provider: BoardSource
  /**
   * Whether this was a development build.
   *
   * It matters and it is not noise: React's StrictMode double-invokes the
   * arrival effect in development, so a dev board really does cost two calls.
   * That is the true cost of that session and belongs in the count — but a
   * report that mixed it with production would overstate a deployed room by
   * roughly the arrival board every round. So it is recorded, and split.
   */
  dev: boolean
  kind: CallKind
  outcome: CallOutcome
  n: number
}

function nowHour(): string {
  return new Date().toISOString().slice(0, 13)
}

/**
 * Every read and write is wrapped.
 *
 * A private window, cleared site data, or a browser set to block storage all
 * throw on access rather than returning nothing. A picker that broke because
 * its diagnostic could not write would be a bad trade for a number nobody asked
 * for — so this degrades to counting nothing at all.
 */
function read(): Row[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Row[]) : []
  } catch {
    return []
  }
}

function write(rows: Row[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // Full, blocked, or absent. Nothing here is worth surfacing to a player.
  }
}

/** Drop anything past the window, then anything past the cap, oldest first. */
function prune(rows: Row[]): Row[] {
  const cutoff = new Date(Date.now() - KEEP_HOURS * 3_600_000).toISOString().slice(0, 13)
  const kept = rows.filter((row) => row.hour >= cutoff)
  return kept.length > MAX_ROWS ? kept.slice(kept.length - MAX_ROWS) : kept
}

/**
 * One call against a provider.
 *
 * Called from `fetchBoard`, which every adapter goes through, so this is the
 * single place a board is counted. A call that threw is still a call and is
 * still counted — that is the entire point, since a 429 costs the allowance
 * exactly as much as a board that arrived.
 */
export function recordCall(
  provider: BoardSource,
  kind: CallKind,
  outcome: CallOutcome,
): void {
  // The offline shelf costs nobody anything. Counting it would inflate the one
  // number this exists to get right.
  if (provider === 'sample') return

  const hour = nowHour()
  const dev = process.env.NODE_ENV !== 'production'
  const rows = prune(read())
  const found = rows.find(
    (row) =>
      row.hour === hour &&
      row.provider === provider &&
      row.dev === dev &&
      row.kind === kind &&
      row.outcome === outcome,
  )
  if (found) found.n += 1
  else rows.push({ hour, provider, dev, kind, outcome, n: 1 })
  write(rows)
}

export interface ProviderUsage {
  provider: GifProviderId
  calls: number
  byKind: Record<CallKind, number>
  failed: number
  /** Times the allowance ran out. Non-zero means a real game hit the ceiling. */
  quota: number
  /** The most calls in any single clock hour — the number an allowance is against. */
  peakHour: number
  /** Which hour that was, so it can be tied back to a session. */
  peakAt?: string
}

export interface UsageReport {
  /** When counting started and last happened, in UTC hours. */
  from?: string
  to?: string
  hoursObserved: number
  production: ProviderUsage[]
  development: ProviderUsage[]
}

function summarise(rows: Row[]): ProviderUsage[] {
  const byProvider = new Map<GifProviderId, ProviderUsage>()
  const hourly = new Map<string, number>()

  for (const row of rows) {
    if (row.provider === 'sample') continue
    const id = row.provider
    const entry = byProvider.get(id) ?? {
      provider: id,
      calls: 0,
      byKind: { trending: 0, search: 0, share: 0, items: 0 },
      failed: 0,
      quota: 0,
      peakHour: 0,
    }
    entry.calls += row.n
    entry.byKind[row.kind] += row.n
    if (row.outcome === 'failed') entry.failed += row.n
    if (row.outcome === 'quota') entry.quota += row.n
    byProvider.set(id, entry)

    const key = `${id}|${row.hour}`
    hourly.set(key, (hourly.get(key) ?? 0) + row.n)
  }

  for (const [key, n] of hourly) {
    const [id, hour] = key.split('|') as [GifProviderId, string]
    const entry = byProvider.get(id)
    if (entry && n > entry.peakHour) {
      entry.peakHour = n
      entry.peakAt = hour
    }
  }

  return [...byProvider.values()].sort((a, b) => b.calls - a.calls)
}

/**
 * What to put in the application.
 *
 * Production and development are reported apart because they are not the same
 * measurement — see `Row.dev`. Quote the production figures; the development
 * ones are inflated by StrictMode's double arrival and are useful mainly as a
 * sanity check that counting is happening at all.
 *
 * **`peakHour` is one browser's peak, not one room's.** Every player pays for
 * their own boards, so a room of N costs roughly N times what this reports for
 * the seat you were sitting in. That multiplication is the honest way to read
 * this against an hourly allowance, and it is why the report says
 * `hoursObserved` rather than pretending to a rate.
 */
export function usageReport(): UsageReport {
  const rows = prune(read())
  const hours = [...new Set(rows.map((row) => row.hour))].sort()

  return {
    from: hours[0],
    to: hours[hours.length - 1],
    hoursObserved: hours.length,
    production: summarise(rows.filter((row) => !row.dev)),
    development: summarise(rows.filter((row) => row.dev)),
  }
}

/** Start again. Offered because a report full of a stub run is worse than none. */
export function clearUsage(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // Same reasoning as `write`.
  }
}
