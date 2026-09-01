import { afterEach, describe, expect, it, vi } from 'vitest'
import { GifProviderError, GifQuotaError } from './errors'
import { klipyProvider } from './klipy'
import { firstPage } from './provider'

/**
 * The Klipy adapter, tested against the shapes a live key actually returned on
 * 2026-08-31 rather than against the documentation, which was unreachable.
 *
 * Every fixture below is trimmed from a real response. Where Klipy differs from
 * Giphy it differs in ways that fail quietly — a filter that falls open, an
 * invalid key that answers 404, a `per_page` ceiling that clamps instead of
 * complaining — so these are the tests that earn their place.
 */

const query = { q: 'deploy', limit: 50, cursor: firstPage('klipy') }
const search = (apiKey = 'key') => klipyProvider.search(query, apiKey)

/** One real item, trimmed to the fields the adapter reads. */
function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 7219512215360752,
    slug: 'bunny-deploy--kgr6Utsfe',
    title: 'Bunny Deploy',
    type: 'gif',
    tags: [],
    file: {
      hd: { mp4: { url: 'https://static.klipy.com/x/hd.mp4', width: 440, height: 554 } },
      md: {
        gif: { url: 'https://static.klipy.com/x/md.gif', width: 220, height: 277 },
        webp: { url: 'https://static.klipy.com/x/md.webp', width: 220, height: 277 },
        mp4: { url: 'https://static.klipy.com/x/md.mp4', width: 220, height: 277 },
      },
      sm: { webp: { url: 'https://static.klipy.com/x/sm.webp', width: 165, height: 208 } },
      xs: { jpg: { url: 'https://static.klipy.com/x/xs.jpg', width: 110, height: 139 } },
    },
    ...overrides,
  }
}

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function ok(items: unknown[] = [item()]) {
  return answer(200, {
    result: true,
    data: { data: items, current_page: 1, per_page: 50, has_next: true },
  })
}

function mockFetch(response: () => Response) {
  const fetchMock =
    vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () =>
      response(),
    )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('failure, which Klipy signals two different ways', () => {
  it('treats 429 as a spent allowance, not a failed search', async () => {
    mockFetch(() => answer(429, {}))

    await expect(search()).rejects.toBeInstanceOf(GifQuotaError)
  })

  it('leaves every other status an ordinary GifProviderError', async () => {
    mockFetch(() => answer(500, {}))

    const error = await search().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GifProviderError)
    expect(error).not.toBeInstanceOf(GifQuotaError)
  })

  it('fails on `result: false` even though the status is 200', async () => {
    // Klipy answers an invalid key with **404**, not 401 or 403, and carries
    // the real reason in the envelope. A client that trusted the status alone
    // would report the wrong thing for a whole class of failure — so the
    // envelope is checked even when the status is fine.
    mockFetch(() =>
      answer(200, { result: false, errors: { message: ['The provided API key is invalid.'] } }),
    )

    const error = await search().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GifProviderError)
    expect((error as Error).message).toContain('The provided API key is invalid.')
  })

  it('names the provider that failed', async () => {
    mockFetch(() => answer(429, {}))

    const error = (await search().catch((e: unknown) => e)) as GifQuotaError
    expect(error.provider).toBe('klipy')
  })
})

describe('the request', () => {
  it('always sends the SFW filter, because Klipy fails open without it', async () => {
    const fetchMock = mockFetch(() => ok())

    await search()

    // Verified against the live API: `content_filter=nonsense` and no
    // `content_filter` at all both return exactly what `off` returns, at HTTP
    // 200 with `result: true`. Nothing reports a problem. So the absence of
    // this parameter is not a weaker filter, it is no filter, under a picker
    // that promises "SFW filter on".
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('content_filter=high')
  })

  it('puts the app key in the path, never the query string', async () => {
    const fetchMock = mockFetch(() => ok())

    await klipyProvider.search(query, 'secret-key')

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname.startsWith('/api/v1/secret-key/gifs/')).toBe(true)
    // The trap a lazy port of the Giphy client falls into.
    expect(url.search).not.toContain('secret-key')
  })

  it('never sends format_filter, which would strip every rendition but one', async () => {
    const fetchMock = mockFetch(() => ok())

    await search()

    // The trap: `format_filter=gif` reads like "give us GIFs" and actually
    // means "give us *only* the gif rendition", nulling `webp`, `mp4` and the
    // `jpg` still. That is the WebP the board renders instead of fifty animated
    // GIFs on a phone, the MP4 the wall plays, and the frame a reduced-motion
    // viewer sees. Verified live: omitted returns five formats at four
    // qualities, `format_filter=gif` returns one.
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('format_filter')
  })

  it('turns the zero-based cursor into Klipy’s one-based page', async () => {
    const fetchMock = mockFetch(() => ok())

    await klipyProvider.search({ ...query, cursor: { provider: 'klipy', page: 0 } }, 'key')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('page=1')

    await klipyProvider.search({ ...query, cursor: { provider: 'klipy', page: 2 } }, 'key')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('page=3')
  })

  it('asks trending when there is no term, and search when there is', async () => {
    const fetchMock = mockFetch(() => ok())

    await klipyProvider.search({ ...query, q: '   ' }, 'key')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/gifs/trending')

    await klipyProvider.search({ ...query, q: 'deploy' }, 'key')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/gifs/search')
  })

  it('carries no cache directive', async () => {
    const fetchMock = mockFetch(() => ok())

    await search()

    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { next?: unknown }) | undefined
    // Klipy serves this endpoint through Cloudflare with `max-age=21600` of its
    // own, so a second cache here would buy nothing and would outlive content
    // they had pulled.
    expect(init?.next).toBeUndefined()
    expect(init?.cache).toBeUndefined()
  })
})

describe('the double-nested envelope', () => {
  it('reads items from data.data, not data', async () => {
    mockFetch(() => ok())

    const board = await search()

    expect(board.items).toHaveLength(1)
    expect(board.items[0]?.id).toBe('bunny-deploy--kgr6Utsfe')
  })

  it('yields an empty board rather than throwing when a level is missing', async () => {
    mockFetch(() => answer(200, { result: true, data: {} }))

    await expect(search()).resolves.toEqual({ items: [], ads: [], hasMore: false })
  })

  it('takes Klipy at its word about a next page', async () => {
    // "Shuffle results" turns the page when this is true and wraps back to the
    // first when it is not, so a wrong answer here strands the control on an
    // empty board at the end of a thin result set.
    mockFetch(() => ok())
    await expect(search()).resolves.toMatchObject({ hasMore: true })

    mockFetch(() =>
      answer(200, { result: true, data: { data: [item()], has_next: false } }),
    )
    await expect(search()).resolves.toMatchObject({ hasMore: false })

    // A body that did not say has no next page — absent means no, never yes.
    mockFetch(() => answer(200, { result: true, data: { data: [item()] } }))
    await expect(search()).resolves.toMatchObject({ hasMore: false })
  })

  it('carries the slug as the id, not the numeric id', async () => {
    mockFetch(() => ok())

    const board = await search()

    // The share trigger and `gifs/items` both take slugs; the numeric id is
    // useless to either. `toMediaRef` drops this before it reaches game state,
    // so the per-response token in a search slug never becomes durable.
    expect(board.items[0]?.id).toBe('bunny-deploy--kgr6Utsfe')
  })

  it('reads the tile and its ratio off the same rendition', async () => {
    mockFetch(() => ok())

    const [gif] = await search().then((b) => b.items)

    expect(gif?.src).toBe('https://static.klipy.com/x/md.gif')
    expect(gif?.width).toBe(220)
    expect(gif?.height).toBe(277)
  })

  it('carries every rendition the app renders somewhere', async () => {
    mockFetch(() => ok())

    const [gif] = await search().then((b) => b.items)

    // Each of these has a consumer: `webp` is the board's tile, `mp4` is the
    // landing wall, `still` is what a reduced-motion viewer sees. A live board
    // of fifty returned all three for every tile.
    expect(gif?.webp).toBe('https://static.klipy.com/x/md.webp')
    expect(gif?.mp4).toBe('https://static.klipy.com/x/md.mp4')
    expect(gif?.still).toBe('https://static.klipy.com/x/xs.jpg')
  })

  it('never leaves alt empty', async () => {
    mockFetch(() => ok([item({ title: '   ' })]))

    const [gif] = await search().then((b) => b.items)

    // This becomes the accessible name in the picker, the vote card's `alt`,
    // and `MediaRef.alt` in game state for the rest of the round.
    expect(gif?.alt).toBe('A GIF')
  })
})

describe('what comes back, and what cannot be drawn', () => {
  it('asks for ads at a size that fits the narrowest column', async () => {
    const fetchMock = mockFetch(() => ok())

    await search()

    // All five are required for delivery. The sizes come from the descriptor
    // because they are a layout fact: an iframe clips rather than scales, and
    // Klipy caps rescaling at ten percent, so the ad has to arrive already
    // fitting.
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('customer_id')).toBeTruthy()
    expect(url.searchParams.get('ad-min-width')).toBe('250')
    expect(url.searchParams.get('ad-max-width')).toBe('280')
    expect(url.searchParams.get('ad-min-height')).toBe('50')
    expect(url.searchParams.get('ad-max-height')).toBe('100')
  })

  it('never sends a player’s identity as the ad customer id', async () => {
    const fetchMock = mockFetch(() => ok())

    await search()

    // A room is a work chat with real names in it. The id is a per-tab random
    // that dies with the session — never a nickname, a seat id, or anything
    // anybody typed. See `customer.ts`.
    const id = new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('customer_id') ?? ''
    expect(id).toMatch(/^[0-9a-f-]{36}$|^s-[a-z0-9]+$/)
  })

  it('does not filter on type, because that is their call and not ours', async () => {
    // A real ad object carries no `slug` and no `file` — it is
    // `{ type, width, height, content }` — so it is dropped by the rule below
    // for being undrawable, not by a judgement about what it is. The adapter no
    // longer inspects `type` at all.
    mockFetch(() =>
      ok([item({ slug: 'a' }), item({ slug: 'b', type: 'something-new' }), item({ slug: 'c' })]),
    )

    const board = await search()

    // Order and composition preserved: an unfamiliar `type` that is still
    // drawable is still shown.
    expect(board.items.map((gif) => gif.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops only an item that cannot be rendered at all', async () => {
    mockFetch(() => ok([item({ slug: 'a' }), item({ slug: 'broken', file: {} })]))

    const board = await search()

    expect(board.items.map((gif) => gif.id)).toEqual(['a'])
  })

  it('carries an ad on its own channel rather than dropping it', async () => {
    mockFetch(() =>
      ok([
        item({ slug: 'a' }),
        { type: 'ad', width: 250, height: 100, content: '<html>ad</html>' },
        item({ slug: 'c' }),
      ]),
    )

    const board = await search()

    // Everything returned is still rendered — the ad on the surface its shape
    // suits. Splitting is not filtering; dropping would have been.
    expect(board.items.map((gif) => gif.id)).toEqual(['a', 'c'])
    expect(board.ads).toEqual([{ content: '<html>ad</html>', width: 250, height: 100 }])
  })

  it('keeps an ad structurally incapable of becoming a tile', async () => {
    mockFetch(() =>
      ok([{ type: 'ad', width: 250, height: 100, content: '<html>ad</html>' }]),
    )

    const board = await search()

    // Nothing that reads `items` can reach an ad, so no pick, no auto-pick and
    // no "surprise me" can put an advertiser's HTML into game state.
    expect(board.items).toEqual([])
    expect(board.ads).toHaveLength(1)
  })

  it('ignores an ad with no document or no size to draw it at', async () => {
    mockFetch(() =>
      ok([
        { type: 'ad', width: 250, height: 100 },
        { type: 'ad', content: '<html>ad</html>' },
        { type: 'ad', width: 0, height: 100, content: '<html>ad</html>' },
      ]),
    )

    const board = await search()

    expect(board.ads).toEqual([])
  })
})

describe('the share trigger', () => {
  it('posts the slug and never blocks or throws', async () => {
    const fetchMock = mockFetch(() => ok())

    expect(() => klipyProvider.share?.('bunny-deploy--kgr6Utsfe', 'key', 'deploy')).not.toThrow()

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('/api/v1/key/gifs/share/bunny-deploy--kgr6Utsfe')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
  })

  it('swallows a failure, because a lost ping must not cost a pick', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )

    expect(() => klipyProvider.share?.('slug', 'key')).not.toThrow()
    // The rejection is handled inside; nothing here is left unhandled.
    await Promise.resolve()
  })
})
