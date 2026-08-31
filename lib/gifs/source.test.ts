import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
const PROVIDER = 'NEXT_PUBLIC_GIF_PROVIDER'

afterEach(() => {
  delete process.env[KEY]
  delete process.env[STUB]
})

describe('resolving a board', () => {
  it('serves the offline shelf when there is no key', async () => {
    // A fresh clone should render a working picker before it renders an error.
    const body = await fetchBoard('', undefined, 50)

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

    const body = await fetchBoard('', undefined, 50)

    // The whole point of the sticky switch: a long afternoon of layout work
    // must not spend the hourly allowance.
    expect(body.source).toBe('sample')
  })

  it('narrows the shelf on a query', async () => {
    const body = await fetchBoard('deploy', undefined, 50)

    expect(body.query).toBe('deploy')
    expect(body.results.some((gif) => gif.id.includes('deploy'))).toBe(true)
    expect(body.results.length).toBeLessThan(SAMPLE_GIFS.length)
  })

  it('still answers when the query matches nothing', async () => {
    const body = await fetchBoard('zzzzzzz', undefined, 50)

    // A blank grid reads as broken, so an unmatched search falls back to the
    // whole shelf rather than an empty one.
    expect(body.results.length).toBe(SAMPLE_GIFS.length)
  })

  it('reports a source, never a blend of both', async () => {
    // Giphy's terms forbid mixing their grid with another provider's, so a
    // response is one shelf or the other and says which.
    const body = await fetchBoard('', undefined, 50)

    expect(['giphy', 'klipy', 'sample']).toContain(body.source)
    const ids = body.results.map((gif) => gif.id)
    expect(ids.every((id) => id.startsWith('sample-'))).toBe(true)
  })
})

/**
 * Which provider a live board comes from.
 *
 * These are the only tests that reach the live path, so they are the only ones
 * that have to stub `fetch` — the shelf tests above never get that far.
 */
describe('choosing a provider', () => {
  function stubFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env[PROVIDER]
  })

  it('uses the only adapter that has a key', async () => {
    process.env[KEY] = 'a-real-looking-key'
    stubFetch()

    const body = await fetchBoard('', undefined, 50)

    expect(body.source).toBe('giphy')
  })

  it('falls through to a provider that works rather than erroring', async () => {
    // Naming a provider with no key is a misconfiguration, not a reason to
    // hand a fresh clone a configuration lecture instead of a picker.
    process.env[PROVIDER] = 'klipy'
    process.env[KEY] = 'a-real-looking-key'
    stubFetch()

    const body = await fetchBoard('', undefined, 50)

    expect(body.source).toBe('giphy')
  })

  it('ignores a provider name it does not know', async () => {
    process.env[PROVIDER] = 'nonsense'
    process.env[KEY] = 'a-real-looking-key'
    stubFetch()

    const body = await fetchBoard('', undefined, 50)

    expect(body.source).toBe('giphy')
  })

  it('hands back a cursor stamped with whoever answered', async () => {
    process.env[KEY] = 'a-real-looking-key'
    stubFetch()

    const body = await fetchBoard('', undefined, 50)

    // A cursor minted against one provider is meaningless to another, so it
    // carries the provider that minted it rather than a bare number.
    expect(body.cursor.provider).toBe('giphy')
  })
})

/**
 * The one invariant the type system cannot hold.
 *
 * `NEXT_PUBLIC_*` is inlined by literal name at build time, so a computed
 * `process.env[id]` returns `undefined` in the browser — while working
 * perfectly in vitest, which runs in Node. That combination is how this breaks
 * in production only, and it is why the check is a source read rather than a
 * behavioural test: there is no behaviour here that Node can be made to get
 * wrong.
 */
describe('the registry’s environment reads', () => {
  const src = readFileSync(new URL('./registry.ts', import.meta.url), 'utf8')
  // Comments stripped first, because the file explains the trap it is avoiding
  // and naming the bad form in prose is not committing it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('names every key as a full literal', () => {
    expect(code).toContain('process.env.NEXT_PUBLIC_GIPHY_API_KEY')
    expect(code).toContain('process.env.NEXT_PUBLIC_GIF_PROVIDER')
  })

  it('never indexes process.env dynamically', () => {
    expect(code).not.toMatch(/process\.env\[/)
  })
})
