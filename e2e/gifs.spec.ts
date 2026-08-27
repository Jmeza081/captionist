import { expect, test } from '@playwright/test'

/**
 * The Giphy proxy, tested through `request` rather than a browser — there is
 * no UI involved, and a spec that depends on a live third party is not a test.
 *
 * `stub=1` is the same switch the `?gifs=stub` lever throws, so CI never needs
 * a key and never burns rate limit.
 */
test.describe('the GIF search route', () => {
  test('returns usable results without a Giphy key', async ({ request }) => {
    const response = await request.get('/api/gifs?stub=1')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.source).toBe('sample')
    expect(body.results.length).toBeGreaterThan(0)

    for (const gif of body.results) {
      // `alt` becomes the accessible name here and `MediaRef.alt` in game
      // state for the rest of the round, so an empty one is never acceptable.
      expect(gif.alt.length).toBeGreaterThan(0)
      expect(gif.src.length).toBeGreaterThan(0)
      expect(gif.id.length).toBeGreaterThan(0)
    }

    const ids = body.results.map((g: { id: string }) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('narrows on a query and still answers when nothing matches', async ({ request }) => {
    const hit = await (await request.get('/api/gifs?stub=1&q=deploy')).json()
    expect(hit.query).toBe('deploy')
    expect(hit.results.some((g: { id: string }) => g.id.includes('deploy'))).toBe(true)

    // A blank grid reads as broken, so an unmatched search falls back to the shelf.
    const miss = await (await request.get('/api/gifs?stub=1&q=zzzzzzz')).json()
    expect(miss.results.length).toBeGreaterThan(0)
  })

  test('clamps a limit nobody should be asking for', async ({ request }) => {
    const body = await (await request.get('/api/gifs?stub=1&limit=999')).json()
    expect(body.results.length).toBeLessThanOrEqual(24)
  })

  test('serves the sample art it points at', async ({ request }) => {
    const body = await (await request.get('/api/gifs?stub=1')).json()
    const first = body.results[0]
    const image = await request.get(first.src)
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toContain('svg')
  })
})
