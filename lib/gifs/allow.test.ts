import { describe, expect, it } from 'vitest'
import { isAllowedImageSrc } from './allow'
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
