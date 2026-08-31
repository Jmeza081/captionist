/**
 * The identifier an ad request carries, and deliberately the weakest one that
 * works.
 *
 * Klipy documents `customer_id` as the "unique ID of user in your system" and
 * uses it for ad targeting and for the per-user recent-items endpoints. That is
 * a tracking identifier, so the question is not how to generate one but how
 * little it is allowed to know.
 *
 * Three things it is **not**:
 *
 *   - **Not a player's identity.** Never the nickname, the avatar, the seat's
 *     `PlayerId` or anything anybody typed. A room is a work chat with names in
 *     it; none of that belongs in an ad request.
 *   - **Not durable.** It lives in `sessionStorage`, so it dies with the tab.
 *     A `localStorage` id would follow one person across every session and
 *     build exactly the long-lived profile nobody here asked for. The cost is
 *     worse ad targeting, which is a cost this app is happy to pay — no revenue
 *     depends on it.
 *   - **Not shared.** It never crosses the event lane and no other player ever
 *     sees it.
 *
 * The result is an id that lets one board's ads be requested coherently and
 * forgets everything the moment the tab closes.
 */

const KEY = 'captionist:ad-session:v1'

/**
 * A random id for this tab, minted on first use.
 *
 * Falls back to a fresh per-call value when storage is unavailable — a private
 * window, or a browser blocking site data. Ads may target worse; nothing
 * breaks, which is the right failure for something this optional.
 */
export function adSessionId(): string {
  const fresh = () =>
    // `randomUUID` needs a secure context; the fallback keeps a plain-http dev
    // origin working rather than throwing inside a fetch.
    globalThis.crypto?.randomUUID?.() ?? `s-${Math.random().toString(36).slice(2)}`

  try {
    const held = globalThis.sessionStorage?.getItem(KEY)
    if (held) return held
    const id = fresh()
    globalThis.sessionStorage?.setItem(KEY, id)
    return id
  } catch {
    return fresh()
  }
}
