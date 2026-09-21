import { describe, expect, it } from 'vitest'
import { releaseDate, RELEASES_URL, toSafeHtml } from './releases'

/**
 * The fetch itself is not unit-tested — it is a network call behind a
 * framework cache, and a mock of it would assert the mock. What is tested is
 * the part that had a real bug in it.
 */
describe('GitHub’s rendered notes', () => {
  it('absolutises the relative links GitHub actually sends', () => {
    // Verbatim from this repo's own v0.1.0 payload. On our own origin this
    // href resolves against captionist.fun and 404s.
    const html = '<p>see <a href="/Jmeza081/captionist/blob/v0.1.0/docs/adr">the ADRs</a></p>'
    const safe = toSafeHtml(html)

    expect(safe).toContain('href="https://github.com/Jmeza081/captionist/blob/v0.1.0/docs/adr"')
    expect(safe).not.toContain('href="/Jmeza081')
  })

  it('sends every link out the way the rest of the app does', () => {
    const safe = toSafeHtml('<p><a href="/x">x</a> and <a href="https://y.example">y</a></p>')
    expect(safe.match(/target="_blank"/g)).toHaveLength(2)
    expect(safe.match(/rel="noreferrer noopener"/g)).toHaveLength(2)
  })

  it('leaves an already-absolute link alone', () => {
    const safe = toSafeHtml('<p><a href="https://github.com/Jmeza081">me</a></p>')
    expect(safe).toContain('href="https://github.com/Jmeza081"')
    expect(safe).not.toContain('https://github.com/https://')
  })

  it('knows where to send somebody when it cannot help', () => {
    expect(RELEASES_URL).toBe('https://github.com/Jmeza081/captionist/releases')
  })
})

describe('the date on a release', () => {
  it('spells the month out, because a changelog is read rather than scanned', () => {
    expect(releaseDate('2026-09-21T16:03:24Z')).toBe('21 September 2026')
  })

  it('says nothing rather than "Invalid Date"', () => {
    expect(releaseDate('not a date')).toBe('')
    expect(releaseDate('')).toBe('')
  })
})
