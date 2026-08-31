import { describe, expect, it } from 'vitest'
import { devGuestCount, devGuestDelay, MAX_DEV_GUESTS } from './devGuests'

/**
 * The two things that make this safe to leave in the tree: it opens no tabs
 * unless asked, and it never opens so many that a typo costs you your browser.
 */
describe('how many guests open', () => {
  it('opens none by default', () => {
    // No environment variable in the test run, and nothing asked for.
    expect(devGuestCount()).toBe(0)
  })

  it('opens what was asked for', () => {
    expect(devGuestCount(3)).toBe(3)
  })

  it('caps a typo rather than opening forty tabs', () => {
    expect(devGuestCount(400)).toBe(MAX_DEV_GUESTS)
  })

  it('treats zero and nonsense as none', () => {
    expect(devGuestCount(0)).toBe(0)
    expect(devGuestCount(-2)).toBe(0)
    expect(devGuestCount(Number.NaN)).toBe(0)
    expect(devGuestCount(1.5)).toBe(0)
  })
})

describe('when each guest lets itself in', () => {
  it('never sends the first guest at zero', () => {
    // Under ADR-0007 the first tab to ask owns the room, and these are opened
    // from the same click that sends the host to it. A guest at zero beat the
    // host to its own room and took the crown.
    expect(devGuestDelay(0)).toBeGreaterThan(0)
  })

  it('queues them, because the person record is shared by every tab', () => {
    // Nickname and face live in one `localStorage` entry; the seat is per-tab.
    // Simultaneous writes leave every tab reading back the last one.
    expect(devGuestDelay(1)).toBeGreaterThan(devGuestDelay(0))
    expect(devGuestDelay(2)).toBeGreaterThan(devGuestDelay(1))
  })
})
