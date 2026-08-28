import { describe, expect, it } from 'vitest'
import { animatedSrcFor } from './noto'
import { NOTO_REACTIONS } from './reactions.catalog'
import { REACTIONS } from './reactions'

describe('finding a reaction’s animation', () => {
  it('derives the CDN URL from the still, spelling the codepoint Google’s way', () => {
    expect(animatedSrcFor('/media/emoji/1f600.svg')).toBe(
      'https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.webp',
    )
    // The catalog uses dashes so its filenames clear the image allowlist's
    // character class; Google uses underscores. This is the whole hop.
    expect(animatedSrcFor('/media/emoji/1f3f3-fe0f.svg')).toBe(
      'https://fonts.gstatic.com/s/e/notoemoji/latest/1f3f3_fe0f/512.webp',
    )
  })

  it('offers nothing for art that already moves on its own terms', () => {
    // The four authored Slackmojis are SVGs with their own keyframes, and a
    // character is a character. Neither has a rendition on Google's CDN.
    expect(animatedSrcFor('/media/slackmoji-lgtm.svg')).toBeNull()
    expect(animatedSrcFor('🔥')).toBeNull()
    expect(animatedSrcFor('/media/stub-01.svg')).toBeNull()
  })

  it('offers nothing for anything shaped like an escape', () => {
    expect(animatedSrcFor('/media/emoji/../secret.svg')).toBeNull()
    expect(animatedSrcFor('https://evil.example/media/emoji/1f600.svg')).toBeNull()
    expect(animatedSrcFor('/media/emoji/1f600.svg?x=1')).toBeNull()
    expect(animatedSrcFor('')).toBeNull()
  })

  it('covers the whole catalog and nothing else in the set', () => {
    for (const r of NOTO_REACTIONS) expect(animatedSrcFor(r.glyph)).not.toBeNull()

    const curated = REACTIONS.filter((r) => !r.id.startsWith('noto-'))
    for (const r of curated) expect(animatedSrcFor(r.glyph)).toBeNull()
  })
})
