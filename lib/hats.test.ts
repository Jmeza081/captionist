import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { FaceHat } from './game/types'
import { asHatId, CROWN, hatArt, HAT_IDS, HAT_LABELS, HAT_WINDOW, isHatId } from './hats'

describe('the catalogue', () => {
  it('is sixteen distinct hats', () => {
    expect(HAT_IDS).toHaveLength(16)
    expect(new Set(HAT_IDS).size).toBe(HAT_IDS.length)
  })

  it('has art and a name for every one, and for the crown', () => {
    for (const id of [...HAT_IDS, CROWN] as FaceHat[]) {
      expect(hatArt(id), id).toBeDefined()
      expect(HAT_LABELS[id], id).toBeTruthy()
    }
  })

  it('ships the file it names', () => {
    // The map is a compile-time contract with `HatId` and a runtime promise
    // about `public/`. Only this half can be broken by a `git mv`.
    for (const id of [...HAT_IDS, CROWN] as FaceHat[]) {
      const art = hatArt(id)!
      expect(existsSync(join(process.cwd(), 'public', art)), art).toBe(true)
    }
  })

  it('offers fewer than it holds, so the picker arrives folded', () => {
    expect(HAT_WINDOW).toBeLessThan(HAT_IDS.length)
  })
})

describe('hatArt', () => {
  it('builds no path, it looks one up', () => {
    // Every value is a literal in the map. If this ever fails it is because
    // somebody started interpolating an id into a string, which is the one
    // thing this module exists to prevent.
    for (const id of [...HAT_IDS, CROWN] as FaceHat[]) {
      expect(hatArt(id)).toMatch(/^\/media\/hats\/[a-z]+\.svg$/)
    }
  })

  /**
   * The reason it is `Object.hasOwn` and not `in`, and not a bare index.
   *
   * All four of these resolve through the prototype chain, and
   * `HAT_ART['constructor']` is a *function* — which stringifies into an
   * `<img src>` rather than failing. Simplify this guard and this test is what
   * says so.
   */
  it('does not reach through the prototype chain', () => {
    expect(hatArt('__proto__')).toBeUndefined()
    expect(hatArt('constructor')).toBeUndefined()
    expect(hatArt('toString')).toBeUndefined()
    expect(hatArt('valueOf')).toBeUndefined()
    expect(hatArt('hasOwnProperty')).toBeUndefined()
  })

  it('gives nothing to an id nobody minted', () => {
    expect(hatArt(undefined)).toBeUndefined()
    expect(hatArt('')).toBeUndefined()
    expect(hatArt('../../../etc/passwd')).toBeUndefined()
    expect(hatArt('/media/hats/party.svg')).toBeUndefined()
    expect(hatArt('party.svg" onerror="alert(1)')).toBeUndefined()
    expect(hatArt('PARTY')).toBeUndefined()
  })
})

describe('isHatId', () => {
  /**
   * The asymmetry that makes the crown unclaimable: `hatArt` knows seventeen,
   * `isHatId` admits sixteen. The reducer runs the second on the way in, so a
   * peer sending `{ hat: 'crown' }` joins bare-headed.
   */
  it('knows the crown is not a hat anybody may wear', () => {
    expect(hatArt(CROWN)).toBeDefined()
    expect(isHatId(CROWN)).toBe(false)
    expect(asHatId(CROWN)).toBeUndefined()
  })

  it('admits exactly the sixteen', () => {
    for (const id of HAT_IDS) expect(isHatId(id)).toBe(true)
  })

  it('refuses anything that is not one of them', () => {
    for (const value of [undefined, null, 42, {}, [], true, 'wizardry', '']) {
      expect(isHatId(value), String(value)).toBe(false)
      expect(asHatId(value), String(value)).toBeUndefined()
    }
  })
})
