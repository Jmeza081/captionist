import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearUsage, recordCall, usageReport } from './usage'

/**
 * The ledger that turns ADR-0021's arithmetic into a measurement.
 *
 * Its whole value is being trustworthy on the numbers somebody will paste into
 * a production-key application, so the tests are about the ways a counter
 * quietly lies: dropping failures, counting the offline shelf, mixing a
 * development build's doubled arrival into a production figure, or taking the
 * app down when storage is unavailable.
 */

/** A `localStorage` good enough to count with, and to break on purpose. */
function fakeStorage() {
  let store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void (store = new Map()),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('what gets counted', () => {
  it('counts a call that failed, because it still cost the allowance', () => {
    recordCall('klipy', 'search', 'ok')
    recordCall('klipy', 'search', 'failed')
    recordCall('klipy', 'search', 'quota')

    const [klipy] = usageReport().development

    // The point of the ledger: a 429 spends the hour exactly as much as a board
    // that arrived. A counter that only counted successes would understate the
    // one number an allowance is measured against.
    expect(klipy?.calls).toBe(3)
    expect(klipy?.failed).toBe(1)
    expect(klipy?.quota).toBe(1)
  })

  it('never counts the offline shelf, which costs nobody anything', () => {
    recordCall('sample', 'trending', 'ok')
    recordCall('sample', 'search', 'ok')

    const report = usageReport()

    expect(report.development).toEqual([])
    expect(report.production).toEqual([])
  })

  it('splits calls by what they were for', () => {
    recordCall('klipy', 'trending', 'ok')
    recordCall('klipy', 'search', 'ok')
    recordCall('klipy', 'search', 'ok')
    recordCall('klipy', 'share', 'ok')

    const [klipy] = usageReport().development

    expect(klipy?.byKind).toEqual({ trending: 1, search: 2, share: 1, items: 0 })
  })

  it('keeps providers apart, so a migration can be read off it', () => {
    recordCall('klipy', 'search', 'ok')
    recordCall('klipy', 'search', 'ok')
    recordCall('giphy', 'search', 'ok')

    const report = usageReport().development

    expect(report.map((p) => [p.provider, p.calls])).toEqual([
      ['klipy', 2],
      ['giphy', 1],
    ])
  })
})

describe('the peak hour, which is the number an allowance is against', () => {
  it('reports the busiest single hour, not the average', () => {
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-08-31T10:00:00Z'))
    for (let i = 0; i < 3; i += 1) recordCall('klipy', 'search', 'ok')

    vi.setSystemTime(new Date('2026-08-31T11:00:00Z'))
    for (let i = 0; i < 7; i += 1) recordCall('klipy', 'search', 'ok')

    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'))
    recordCall('klipy', 'search', 'ok')

    const report = usageReport()
    const [klipy] = report.development

    // An hourly allowance is not spent at an average rate — it is spent in the
    // worst hour. Eleven calls over three hours is fine; seven in one hour is
    // the figure that decides whether a room fits inside a hundred.
    expect(klipy?.calls).toBe(11)
    expect(klipy?.peakHour).toBe(7)
    expect(klipy?.peakAt).toBe('2026-08-31T11')
    expect(report.hoursObserved).toBe(3)
    expect(report.from).toBe('2026-08-31T10')
    expect(report.to).toBe('2026-08-31T12')
  })
})

describe('the rolling window', () => {
  it('drops anything older than the window', () => {
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-08-01T10:00:00Z'))
    recordCall('klipy', 'search', 'ok')

    // Thirty days later, the old row is past the fourteen-day window.
    vi.setSystemTime(new Date('2026-08-31T10:00:00Z'))
    recordCall('klipy', 'search', 'ok')

    const report = usageReport()

    expect(report.development[0]?.calls).toBe(1)
    expect(report.from).toBe('2026-08-31T10')
  })
})

describe('when storage will not cooperate', () => {
  it('counts nothing rather than throwing', () => {
    // A private window, cleared site data, or a browser set to block storage
    // all throw on access. A picker that broke because its diagnostic could not
    // write would be a bad trade for a number nobody asked for.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })

    expect(() => recordCall('klipy', 'search', 'ok')).not.toThrow()
    expect(() => clearUsage()).not.toThrow()
    expect(usageReport()).toEqual({
      from: undefined,
      to: undefined,
      hoursObserved: 0,
      production: [],
      development: [],
    })
  })

  it('survives a stored value that is not a ledger', () => {
    globalThis.localStorage.setItem('captionist:gif-usage:v1', '{"not":"an array"}')

    expect(() => recordCall('klipy', 'search', 'ok')).not.toThrow()
    expect(usageReport().development[0]?.calls).toBe(1)
  })

  it('survives outright junk', () => {
    globalThis.localStorage.setItem('captionist:gif-usage:v1', 'not json at all')

    expect(usageReport().hoursObserved).toBe(0)
  })
})

describe('starting again', () => {
  it('forgets everything, so a stub run does not poison a report', () => {
    recordCall('klipy', 'search', 'ok')
    clearUsage()

    expect(usageReport().development).toEqual([])
  })
})
