/**
 * Extra players who let themselves in, for looking at a room from more than one
 * seat at once.
 *
 * `?bots=N` already fills a room, and bots are the wrong tool here: they live
 * inside the host's tab, so there is nothing to *look at* — no second viewport,
 * no guest's own chat rail, no second picker spending its own budget. This
 * opens real guest tabs instead, each a separate `BroadcastChannel` peer, which
 * is the same shape `e2e/twotabs.spec.ts` drives by hand.
 *
 * Development only, twice over: the environment variable is read as a full
 * literal so it can be inlined, and `readLevers` refuses the auto-join flag in
 * a production build even if the URL carries one.
 */

export const MAX_DEV_GUESTS = 6

/**
 * How many guest tabs to open with a room. `0` — the default — opens none.
 *
 * `?guests=N` on `/host` beats the environment, so a count can be asked for
 * one room at a time without an `.env` edit or a restart.
 *
 * **The environment variable has to live in `.env.local`, not the shell.**
 * Turbopack inlines `NEXT_PUBLIC_*` from `.env` files; a value exported by the
 * shell reaches the server and never the browser, where it falls through to a
 * `process` polyfill that has never heard of it. That failure is silent —
 * `devGuestCount()` simply returns zero — which is precisely the trap
 * `registry.ts` documents from the other side.
 */
export function devGuestCount(asked?: number): number {
  if (process.env.NODE_ENV === 'production') return 0

  // A full literal, so it can be inlined at all.
  const fromEnv = Number(process.env.NEXT_PUBLIC_DEV_GUESTS)
  const n = asked ?? (Number.isFinite(fromEnv) ? fromEnv : 0)

  // Capped: this opens browser tabs, and a typo should not open forty of them.
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_DEV_GUESTS) : 0
}

/**
 * How long tab `index` waits before letting itself in.
 *
 * Two reasons it is a stagger and not a race, both found by watching it fail.
 *
 * **The host has to claim the room first.** Under ADR-0007 the first tab to ask
 * owns it, and these tabs are opened from the same click that sends the host to
 * `/room/[code]` — so a guest that joined immediately beat the host to its own
 * room and took the crown. The host watched from a guest seat with somebody
 * else marked HOST. Hence `index + 1`: nobody goes at zero.
 *
 * **And the guests have to queue behind each other.** The *person* — nickname
 * and face — is one `localStorage` record every tab shares, while the seat is
 * per-tab. Three tabs writing their identity at once leave all three reading
 * back whichever wrote last, and the roster shows one name three times. Spaced
 * out, each writes, navigates and is read before the next begins.
 */
export function devGuestDelay(index: number): number {
  return (index + 1) * 900
}
