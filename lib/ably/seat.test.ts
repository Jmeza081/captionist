import { describe, expect, it } from 'vitest'
import { mintSeat, verifySeat } from './seat'

const SECRET = 'a-test-secret'

describe('proving a seat is yours', () => {
  it('accepts a seat it issued', () => {
    const { seat, signature } = mintSeat(SECRET)
    expect(verifySeat(seat, signature, SECRET)).toBe(true)
  })

  it('refuses a seat somebody made up', () => {
    // The whole point: without this, any client could ask for a token bearing
    // another player's id, and Ably would faithfully stamp it onto every
    // message they published.
    expect(verifySeat('u-someone-else', 'not-a-signature', SECRET)).toBe(false)
  })

  it('refuses a real seat signed with the wrong secret', () => {
    const { seat, signature } = mintSeat('a-different-secret')
    expect(verifySeat(seat, signature, SECRET)).toBe(false)
  })

  it('refuses an empty seat or an empty signature', () => {
    const { seat, signature } = mintSeat(SECRET)
    expect(verifySeat('', signature, SECRET)).toBe(false)
    expect(verifySeat(seat, '', SECRET)).toBe(false)
  })

  it('does not throw on a signature of the wrong length', () => {
    // `timingSafeEqual` throws on mismatched lengths, and a thrown route is a
    // 500 that tells an attacker their guess was the wrong shape.
    const { seat } = mintSeat(SECRET)
    expect(verifySeat(seat, 'ab', SECRET)).toBe(false)
  })

  it('mints a different seat every time', () => {
    const seats = new Set(Array.from({ length: 50 }, () => mintSeat(SECRET).seat))
    expect(seats.size).toBe(50)
  })
})
