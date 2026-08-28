import { describe, expect, it } from 'vitest'
import { isAllowedImageSrc } from './gifs/allow'
import {
  isImageGlyph,
  labelFor,
  idFor,
  glyphFor,
  QUICK_REACTIONS,
  REACTIONS,
  REVEAL_REACTIONS,
} from './reactions'

/**
 * The invariants the reaction list's ordering rests on.
 *
 * All three were comments before the picker had image tiles, and a comment is
 * not what you want holding up "the composer's one-tap row must not become
 * pictures".
 */
describe('the reaction set', () => {
  it('keeps the one-tap rows to characters, not pictures', () => {
    // `QUICK_REACTIONS` and `REVEAL_REACTIONS` slice off the front, so an image
    // tile drifting into the first six turns a row of keys into a row of GIFs.
    for (const r of QUICK_REACTIONS) expect(r.kind).not.toBe('image')
    for (const r of REVEAL_REACTIONS) expect(isImageGlyph(r.glyph)).toBe(false)
  })

  it('opens on six emoji and four Slackmojis, per DESIGNSYSTEM §4.4', () => {
    const defaults = REACTIONS.slice(0, 10)
    expect(defaults.slice(0, 6).every((r) => r.kind !== 'image')).toBe(true)
    expect(defaults.slice(6, 10).every((r) => r.kind === 'image')).toBe(true)
  })

  it('gives every reaction a pack, so none is unreachable by tab', () => {
    for (const r of REACTIONS) expect(r.pack).toBeTruthy()
    // And each tab holds a grid rather than a handful.
    for (const pack of ['smileys', 'objects'] as const) {
      expect(REACTIONS.filter((r) => r.pack === pack).length).toBeGreaterThanOrEqual(10)
    }
    expect(REACTIONS.filter((r) => r.pack === 'slackmojis')).toHaveLength(4)
  })

  it('never gives two reactions the same id or the same name', () => {
    // A duplicate label breaks `labelFor` (first match wins) and hands two
    // picker tiles one accessible name. 🚢 "Ship it" and the shipit squirrel
    // are the pair this nearly happened to.
    expect(new Set(REACTIONS.map((r) => r.id)).size).toBe(REACTIONS.length)
    expect(new Set(REACTIONS.map((r) => r.label)).size).toBe(REACTIONS.length)
    expect(new Set(REACTIONS.map((r) => r.glyph)).size).toBe(REACTIONS.length)
  })

  it('serves every image tile from somewhere the room will actually render', () => {
    // The picker puts these glyphs on the wire, where `receiveReaction` checks
    // them against the same allowlist. A tile that fails it would be silently
    // dropped for everyone but the sender.
    for (const r of REACTIONS.filter((r) => r.kind === 'image')) {
      expect(isAllowedImageSrc(r.glyph)).toBe(true)
    }
  })

  it('gives every reaction searchable words', () => {
    for (const r of REACTIONS) expect(r.keywords.length).toBeGreaterThan(0)
  })
})

describe('naming a glyph', () => {
  it('round-trips an id and a glyph', () => {
    expect(idFor(glyphFor('shipit'))).toBe('shipit')
    expect(labelFor('🔥')).toBe('Fire')
    expect(labelFor('/media/slackmoji-lgtm.svg')).toBe('LGTM')
  })

  it('never reads a URL out loud', () => {
    // The fallback used to be the glyph itself, which is fine for an emoji and
    // is a path read character by character for a tile.
    expect(labelFor('https://media.giphy.com/x.gif')).toBe('A reaction')
    expect(labelFor('/media/unknown.svg')).toBe('A reaction')
    // An unknown emoji still reads as itself.
    expect(labelFor('🦆')).toBe('🦆')
  })
})
