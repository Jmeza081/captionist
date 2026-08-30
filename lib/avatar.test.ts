import { Avatar, Style } from '@dicebear/core'
import definition from '@dicebear/styles/critters.json' with { type: 'json' }
import { describe, expect, it } from 'vitest'
import { AVATAR_SEEDS, AVATAR_WINDOW, avatarPage, avatarUri, seedLabel } from './avatar'

/**
 * The catalogue and the renderer.
 *
 * Most of this guards things that would fail silently: a face that quietly
 * turns opaque and covers a seat colour, an animation that switches itself on,
 * a seed order that drops somebody's stored face out of view. None of them
 * break a build, and only the last would be obvious on screen.
 */

/** The resolved options DiceBear actually drew with, not the ones we asked for. */
function drawnWith(seed: string) {
  const style = new Style(definition)
  return new Avatar(style, {
    backgroundColor: ['00000000'],
    animationVariant: 'none',
    seed,
  }).toJSON().options
}

describe('avatarUri', () => {
  it('renders a seed into an svg data uri', () => {
    expect(avatarUri('ember')).toMatch(/^data:image\/svg\+xml/)
  })

  it('is deterministic, and memoised', () => {
    // Determinism is what lets every client in a room render a stranger's seed
    // into the same face without being told what it looks like — ADR 0008.
    expect(avatarUri('sunfish')).toBe(avatarUri('sunfish'))
    expect(avatarUri('sunfish')).not.toBe(avatarUri('orbit'))
  })

  it('draws on a transparent background, so the seat colour shows through', () => {
    // DiceBear 10 validates colours as hex and rejects `'transparent'`, and
    // critters' own default background is an opaque indigo. Get this wrong and
    // every avatar in the app becomes a square over the player's colour.
    expect(drawnWith('ember').backgroundColor).toEqual(['#00000000'])
  })

  it('never animates', () => {
    // The moving variants carry `weight: 0` upstream today, so this passes for
    // two reasons. It is here for the day one of them carries a 1 instead.
    expect(drawnWith('ember').animationVariant).toBe('none')
    expect(avatarUri('ember')).not.toContain('%3Cstyle')
  })
})

describe('AVATAR_SEEDS', () => {
  it('is seven full pages of ten', () => {
    // The catalogue's size is not free: `avatarPage` slices fixed windows, so
    // a catalogue that is not a whole number of them ends in a short page —
    // a picker offering four faces because of arithmetic nobody chose. The
    // window went 8 → 10, so the catalogue went 64 → 70 with it.
    expect(AVATAR_SEEDS).toHaveLength(70)
    expect(AVATAR_SEEDS.length % AVATAR_WINDOW).toBe(0)
    expect(new Set(AVATAR_SEEDS).size).toBe(AVATAR_SEEDS.length)
  })

  it('keeps the original seven on the first page', () => {
    // Every seed already in somebody's localStorage is one of these. They stay
    // on page 0 so nobody's saved face falls outside the opening window, and
    // `identity.ts` / `useStoredPerson.ts` both name 'ember' as the literal
    // fallback.
    expect(AVATAR_SEEDS.slice(0, 7)).toEqual([
      'ember',
      'sunfish',
      'orbit',
      'lagoon',
      'moss',
      'amber',
      'fern',
    ])
  })

  it('is seventy different drawings, not seventy names', () => {
    const faces = AVATAR_SEEDS.map((seed) => {
      const o = drawnWith(seed)
      return JSON.stringify([
        o.bodyVariant,
        o.eyesVariant,
        o.mouthVariant,
        o.topVariant,
        o.patternVariant,
        o.cheeksVariant,
        o.bodyColor,
        o.accentColor,
      ])
    })
    expect(new Set(faces).size).toBe(AVATAR_SEEDS.length)
  })

  it('never repeats a body, a pair of eyes and a mouth within one page', () => {
    // A page is the only set of ten ever shown together, so this is where a
    // near-duplicate would actually be noticed. Fix a failure by renaming the
    // offending seed — the names are ours, the mapping is not.
    for (let page = 0; page < AVATAR_SEEDS.length / AVATAR_WINDOW; page++) {
      const seeds = AVATAR_SEEDS.slice(page * AVATAR_WINDOW, (page + 1) * AVATAR_WINDOW)
      const silhouettes = seeds.map((seed) => {
        const o = drawnWith(seed)
        return `${String(o.bodyVariant)}/${String(o.bodyColor)}/${String(o.eyesVariant)}`
      })
      expect(new Set(silhouettes).size, `page ${page}: ${seeds.join(', ')}`).toBe(seeds.length)
    }
  })
})

describe('avatarPage', () => {
  it('is a full window, and always contains its own seed', () => {
    for (const seed of AVATAR_SEEDS) {
      const page = avatarPage(seed)
      expect(page).toHaveLength(AVATAR_WINDOW)
      expect(page).toContain(seed)
    }
  })

  it('opens on the first page for the default seed', () => {
    expect(avatarPage('ember')).toEqual(AVATAR_SEEDS.slice(0, AVATAR_WINDOW))
  })

  it('falls back to the first page for a seed it does not know', () => {
    // A seed left behind by an older build, or by somebody editing storage.
    expect(avatarPage('not-a-seed')).toEqual(AVATAR_SEEDS.slice(0, AVATAR_WINDOW))
  })
})

describe('seedLabel', () => {
  it('is the seed as a person reads it', () => {
    expect(seedLabel('sunfish')).toBe('Sunfish')
  })
})
