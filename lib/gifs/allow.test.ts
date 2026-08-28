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

  it('refuses a same-origin path that is not the app’s own art', () => {
    expect(isAllowedImageSrc('/media/../../etc/passwd')).toBe(false)
    expect(isAllowedImageSrc('/api/ably/token')).toBe(false)
    expect(isAllowedImageSrc('//evil.example/x.gif')).toBe(false)
  })

  it('refuses nonsense without throwing', () => {
    expect(isAllowedImageSrc('')).toBe(false)
    expect(isAllowedImageSrc('not a url')).toBe(false)
    expect(isAllowedImageSrc('x'.repeat(5000))).toBe(false)
  })
})
