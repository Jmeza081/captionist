import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Proving a seat is yours, without a database.
 *
 * Ably makes `Intent.from` trustworthy for free: a token minted with a
 * `clientId` binds it, and the server rejects a publish claiming another. That
 * guarantee is only worth anything if a client cannot ask for a token bearing
 * *someone else's* id — and this app has no server-side session to derive one
 * from, because under [ADR 0003](../../docs/adr/0003-host-authority-over-a-swappable-transport.md)
 * there is no server. The seat is minted in a browser.
 *
 * So the server signs it instead. `/api/ably/token` mints a seat and returns it
 * with an HMAC; the browser keeps both and presents them to renew. A seat with
 * no matching signature is refused, so an id is only usable by whoever was
 * handed it. That is what makes the doc comment on `Intent.from` true here
 * rather than aspirational.
 *
 * Not a login: it identifies a *seat*, not a person, and anyone who copies both
 * halves out of another tab's storage has them. It stops forgery, not sharing —
 * which is the same line every other decision in this app draws.
 *
 * Server-only. `node:crypto` keeps it that way by construction.
 */

/** Long enough to be unguessable, short enough to read in a log. */
const SEAT_BYTES = 9

export interface SignedSeat {
  seat: string
  /** HMAC of `seat`, hex. Meaningless to the client; it just carries it back. */
  signature: string
}

function hmac(seat: string, secret: string): string {
  return createHmac('sha256', secret).update(seat).digest('hex')
}

export function mintSeat(secret: string, random: () => string = randomSeat): SignedSeat {
  const seat = random()
  return { seat, signature: hmac(seat, secret) }
}

function randomSeat(): string {
  const bytes = new Uint8Array(SEAT_BYTES)
  globalThis.crypto.getRandomValues(bytes)
  return `u-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Is this seat one we issued?
 *
 * Compared in constant time. A plain `===` on an HMAC leaks how much of a
 * forged signature was right, one byte at a time, which is enough to build the
 * rest.
 */
export function verifySeat(seat: string, signature: string, secret: string): boolean {
  if (!seat || !signature) return false
  const expected = Buffer.from(hmac(seat, secret), 'utf8')
  const given = Buffer.from(signature, 'utf8')
  // `timingSafeEqual` throws on a length mismatch, which would itself be a
  // signal — so the lengths are checked first and the answer is the same.
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}
