import { afterEach, describe, expect, it, vi } from 'vitest'
import { GifProviderError, GifQuotaError } from './errors'
import { giphyProvider } from './giphy'
import { firstPage } from './provider'

/**
 * The two things about the Giphy adapter the room actually depends on: that a
 * spent allowance is distinguishable from an ordinary failure, and that the
 * request it builds honours the terms it is now subject to.
 */

const query = { q: 'deploy', limit: 50, cursor: firstPage('giphy') }

const search = (apiKey = 'key') => giphyProvider.search(query, apiKey)

function answer(status: number, body: unknown = { data: [] }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a spent allowance', () => {
  it('is its own error, not a failed search', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(429)))

    // The room ends the game on this one and shrugs off the others, so a
    // caller that could not tell them apart would either play on with a dead
    // picker or end the game over a flaky connection.
    await expect(search()).rejects.toBeInstanceOf(GifQuotaError)
  })

  it('is still a GifProviderError, so an unaware caller degrades rather than throws past', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(429)))

    await expect(search()).rejects.toBeInstanceOf(GifProviderError)
  })

  it('leaves every other failure an ordinary GifProviderError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(500)))

    const error = await search().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GifProviderError)
    expect(error).not.toBeInstanceOf(GifQuotaError)
  })

  it('names the provider that failed, so a message can say who', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(429)))

    const error = (await search().catch((e: unknown) => e)) as GifQuotaError
    // The error type is provider-neutral now; the provider rides on the
    // instance so `useGifSearch` never has to import a vendor's name.
    expect(error.provider).toBe('giphy')
  })
})

describe('the request', () => {
  it('carries no cache directive, because the terms forbid one', async () => {
    const fetchMock =
      vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () =>
        answer(200),
      )
    vi.stubGlobal('fetch', fetchMock)

    await search()

    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { next?: unknown }) | undefined
    // `next: { revalidate }` is what used to sit here, and it is exactly what
    // "do not cache media URLs or copies" rules out.
    expect(init?.next).toBeUndefined()
    expect(init?.cache).toBeUndefined()
  })

  it('pins the SFW rating so nothing can raise it', async () => {
    const fetchMock =
      vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () =>
        answer(200),
      )
    vi.stubGlobal('fetch', fetchMock)

    await search()

    const url = String(fetchMock.mock.calls[0]?.[0])
    // The picker promises "SFW filter on", and that promise is only honest if
    // it is unconditional.
    expect(url).toContain('rating=pg-13')
  })

  it('turns the page cursor into Giphy’s item offset', async () => {
    const fetchMock =
      vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () =>
        answer(200),
      )
    vi.stubGlobal('fetch', fetchMock)

    await giphyProvider.search(
      { q: 'deploy', limit: 50, cursor: { provider: 'giphy', page: 2 } },
      'key',
    )

    // The cursor counts pages because Klipy does; Giphy counts items. Doing
    // that arithmetic here is the whole reason the cursor is opaque.
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('offset=100')
  })

  it('keeps Giphy’s order and drops only what cannot be drawn', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        answer(200, {
          data: [
            { id: 'a', title: 'first', images: { fixed_width: { url: 'https://x/a.gif' } } },
            // No id and no image: not a filter on content, a tile with
            // nothing to render.
            { title: 'broken', images: {} },
            { id: 'c', title: 'third', images: { fixed_width: { url: 'https://x/c.gif' } } },
          ],
        }),
      ),
    )

    const board = await search()

    expect(board.items.map((gif) => gif.id)).toEqual(['a', 'c'])
  })
})
