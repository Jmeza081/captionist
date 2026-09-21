import { describe, expect, it } from 'vitest'
import { altGlyph, PAUSE_CODE } from './shortcuts'

/**
 * Only the pure half is unit-tested. `isPauseShortcut` and `isTypingTarget`
 * take a `KeyboardEvent` and an `HTMLElement`, neither of which exists in this
 * suite's node environment — constructing stand-ins would test the stand-ins.
 * Their behaviour is covered against a real browser in `e2e/shortcuts.spec.ts`,
 * which is also the only place the answer actually matters.
 */
describe('the modifier glyph', () => {
  it('draws the Apple key on Apple platforms', () => {
    for (const platform of ['MacIntel', 'MacARM', 'iPhone', 'iPad']) {
      expect(altGlyph(platform)).toBe('⌥')
    }
  })

  it('names the key everywhere else, because that is what is printed on it', () => {
    for (const platform of ['Win32', 'Linux x86_64', 'FreeBSD amd64']) {
      expect(altGlyph(platform)).toBe('Alt')
    }
  })

  it('falls back to the word rather than the symbol', () => {
    // The wrong guess this way is a PC user seeing a word they recognise. The
    // other way is a Mac user hunting for a key labelled "Alt".
    expect(altGlyph(undefined)).toBe('Alt')
    expect(altGlyph('')).toBe('Alt')
  })

  it('binds to the physical key, since ⌥P does not produce "p"', () => {
    // On macOS the character is π. A shortcut means the key, not the glyph it
    // happens to emit under a modifier.
    expect(PAUSE_CODE).toBe('KeyP')
  })
})
