import { describe, expect, it } from 'vitest'
import { isAllowedImageSrc, providerOf } from './allow'
import { SAMPLE_GIFS } from './samples'

describe('what a player may point the room at', () => {
  it('accepts the app’s own art', () => {
    // Every shipped sample has to pass, or the stub lane breaks the moment
    // chat carries one.
    for (const gif of SAMPLE_GIFS) {
      expect(isAllowedImageSrc(gif.src)).toBe(true)
      if (gif.still) expect(isAllowedImageSrc(gif.still)).toBe(true)
    }
  })

  it('accepts Giphy over https, on any of its CDN hosts', () => {
    expect(isAllowedImageSrc('https://media3.giphy.com/media/abc/200w.gif')).toBe(true)
    expect(isAllowedImageSrc('https://i.giphy.com/abc.gif')).toBe(true)
    expect(isAllowedImageSrc('https://giphy.com/abc.gif')).toBe(true)
  })

  it('is not fooled by a hostname that merely starts with the right thing', () => {
    // The whole reason this parses the URL instead of matching a prefix.
    expect(isAllowedImageSrc('https://giphy.com.example.invalid/x.gif')).toBe(false)
    expect(isAllowedImageSrc('https://notgiphy.com/x.gif')).toBe(false)
    expect(isAllowedImageSrc('https://evil.example/?giphy.com')).toBe(false)
  })

  it('refuses the schemes that are not an image on someone else’s screen', () => {
    expect(isAllowedImageSrc('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isAllowedImageSrc('blob:http://127.0.0.1:3000/abc')).toBe(false)
    expect(isAllowedImageSrc('javascript:alert(1)')).toBe(false)
    // Plain http would downgrade every viewer's connection, not just the sender's.
    expect(isAllowedImageSrc('http://media.giphy.com/x.gif')).toBe(false)
  })

  it('accepts the imported emoji catalog, one directory down', () => {
    expect(isAllowedImageSrc('/media/emoji/1f600.svg')).toBe(true)
    // Multi-codepoint tiles spell the joiner with a dash for exactly this.
    expect(isAllowedImageSrc('/media/emoji/1f3f3-fe0f.svg')).toBe(true)
  })

  it('opens that one directory and no others', () => {
    // The point of `(?:emoji\/)?` over `.*`: one known segment, not any path.
    expect(isAllowedImageSrc('/media/emoji/nested/x.svg')).toBe(false)
    expect(isAllowedImageSrc('/media/anything/x.svg')).toBe(false)
    expect(isAllowedImageSrc('/media/emoji/1f600.png')).toBe(false)
    expect(isAllowedImageSrc('/media/emoji/../../etc/passwd.svg')).toBe(false)
  })

  it('refuses a same-origin path that is not the app’s own art', () => {
    expect(isAllowedImageSrc('/media/../../etc/passwd')).toBe(false)
    expect(isAllowedImageSrc('/api/ably/token')).toBe(false)
    expect(isAllowedImageSrc('//evil.example/x.gif')).toBe(false)
  })

  it('still trusts no remote host but Giphy', () => {
    // The catalog's animations come from Google's CDN, but that URL is derived
    // in the browser from a same-origin still — it never travels, so nothing
    // here needs to trust it. If this ever starts passing, check why.
    expect(isAllowedImageSrc('https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.webp')).toBe(
      false,
    )
  })

  it('refuses nonsense without throwing', () => {
    expect(isAllowedImageSrc('')).toBe(false)
    expect(isAllowedImageSrc('not a url')).toBe(false)
    expect(isAllowedImageSrc('x'.repeat(5000))).toBe(false)
  })
})

/**
 * Klipy's CDN, and the trap next door.
 *
 * The hosts come from `descriptors.ts` now, so these also assert that the
 * allowlist unions every provider rather than only the selected one.
 */
describe('Klipy’s media hosts', () => {
  it('accepts all three, because Klipy load-balances across them', () => {
    // Only `static` appeared across 2,144 sampled URLs, but their published
    // requirements list all three and a third-party post-mortem exists of
    // someone allowing just the first and losing most of their results.
    expect(isAllowedImageSrc('https://static.klipy.com/ii/a/25/99/h9f7okKK.gif')).toBe(true)
    expect(isAllowedImageSrc('https://static1.klipy.com/ii/a/25/99/h9f7okKK.gif')).toBe(true)
    expect(isAllowedImageSrc('https://static2.klipy.com/ii/a/25/99/h9f7okKK.gif')).toBe(true)
  })

  it('rejects a lookalike that a suffix match would have admitted', () => {
    // `hostname.endsWith('klipy.com')` — the obvious way to write this — says
    // yes to the first of these. The leading dot, or an exact match, is the
    // whole defence.
    expect(isAllowedImageSrc('https://evilklipy.com/x.gif')).toBe(false)
    expect(isAllowedImageSrc('https://klipy.com.example.invalid/x.gif')).toBe(false)
    expect(isAllowedImageSrc('https://static.klipy.com.evil.tld/x.gif')).toBe(false)
  })

  it('rejects a host Klipy has not published, even under their own domain', () => {
    // Pinned exactly rather than loosely: a subdomain match would admit
    // whatever they put on that domain next, sight unseen.
    expect(isAllowedImageSrc('https://static3.klipy.com/x.gif')).toBe(false)
    expect(isAllowedImageSrc('https://klipy.com/x.gif')).toBe(false)
  })

  it('still refuses plain http on an allowed host', () => {
    expect(isAllowedImageSrc('http://static.klipy.com/x.gif')).toBe(false)
  })

  it('rejects the blur_preview data URI Klipy ships on every item', () => {
    // Real, and exactly what the no-data-URI rule exists for: it would ride the
    // event lane into a full-state message sized for a sentence.
    expect(isAllowedImageSrc('data:image/jpeg;base64,/9j//gAQTGF2YzU5L')).toBe(false)
  })
})

describe('naming who served an image', () => {
  it('reads the provider off the URL, so a MediaRef needs no extra field', () => {
    expect(providerOf('https://static.klipy.com/x.gif')).toBe('klipy')
    expect(providerOf('https://media3.giphy.com/media/x/200w.gif')).toBe('giphy')
  })

  it('credits nobody for the app’s own art', () => {
    expect(providerOf('/media/stub-deploy.svg')).toBeUndefined()
  })

  it('credits nobody for something the allowlist would refuse', () => {
    // Never a fallback to a provider name for a host we do not trust — that
    // would put a brand on content it did not serve.
    expect(providerOf('https://evilklipy.com/x.gif')).toBeUndefined()
    expect(providerOf('not a url')).toBeUndefined()
  })

  it('still names Giphy for a GIF picked before the swap', () => {
    // The reason this is derived rather than stored: a room resumed across a
    // provider change carries the old provider's URLs, and they must still be
    // drawn and still be credited correctly.
    expect(providerOf('https://media0.giphy.com/media/abc/200w.gif')).toBe('giphy')
  })
})
