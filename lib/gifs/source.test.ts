import { afterEach, describe, expect, it } from 'vitest'
import { fetchBoard } from './source'
import { SAMPLE_GIFS } from './samples'

/**
 * Which shelf a board comes from.
 *
 * This logic used to live in `/api/gifs` and was covered by hitting the route.
 * The route is gone — proxying Giphy is against their terms — so the same
 * decisions are tested here, where they moved to. The budget and the hook's
 * fetching belong to Playwright: `vitest.config.ts` keeps this suite on the
 * pure core, and a hook needs a DOM.
 */

const KEY = 'NEXT_PUBLIC_GIPHY_API_KEY'
const STUB = 'NEXT_PUBLIC_GIFS_STUB'

afterEach(() => {
  delete process.env[KEY]
  delete process.env[STUB]
})

describe('resolving a board', () => {
  it('serves the offline shelf when there is no key', async () => {
    // A fresh clone should render a working picker before it renders an error.
    const body = await fetchBoard('', 0, 50)

    expect(body.source).toBe('sample')
    expect(body.results.length).toBe(SAMPLE_GIFS.length)
    for (const gif of body.results) {
      // `alt` becomes the accessible name here and `MediaRef.alt` in game
      // state for the rest of the round, so an empty one is never acceptable.
      expect(gif.alt.length).toBeGreaterThan(0)
      expect(gif.src.length).toBeGreaterThan(0)
      expect(gif.id.length).toBeGreaterThan(0)
    }
  })

  it('forces the shelf even when a key is present', async () => {
    process.env[KEY] = 'a-real-looking-key'
    process.env[STUB] = '1'

    const body = await fetchBoard('', 0, 50)

    // The whole point of the sticky switch: a long afternoon of layout work
    // must not spend the hourly allowance.
    expect(body.source).toBe('sample')
  })

  it('narrows the shelf on a query', async () => {
    const body = await fetchBoard('deploy', 0, 50)

    expect(body.query).toBe('deploy')
    expect(body.results.some((gif) => gif.id.includes('deploy'))).toBe(true)
    expect(body.results.length).toBeLessThan(SAMPLE_GIFS.length)
  })

  it('still answers when the query matches nothing', async () => {
    const body = await fetchBoard('zzzzzzz', 0, 50)

    // A blank grid reads as broken, so an unmatched search falls back to the
    // whole shelf rather than an empty one.
    expect(body.results.length).toBe(SAMPLE_GIFS.length)
  })

  it('reports a source, never a blend of both', async () => {
    // Giphy's terms forbid mixing their grid with another provider's, so a
    // response is one shelf or the other and says which.
    const body = await fetchBoard('', 0, 50)

    expect(['giphy', 'sample']).toContain(body.source)
    const ids = body.results.map((gif) => gif.id)
    expect(ids.every((id) => id.startsWith('sample-'))).toBe(true)
  })
})
