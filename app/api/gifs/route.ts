import { NextResponse } from 'next/server'
import { searchGiphy } from '@/lib/gifs/giphy'
import { SAMPLE_GIFS } from '@/lib/gifs/samples'
import type { GifSearchResponse } from '@/lib/gifs/types'

/**
 * Giphy, proxied so the key stays on the server.
 *
 * `GET /api/gifs?q=deploy&limit=12&offset=0`. No `q` means trending, which is
 * what the picker shows before anyone has typed — and what "Surprise me" draws
 * from.
 *
 * The stub switch has three ways in, all resolved here so no screen has to
 * know which one is on:
 *
 *   - `GIFS_STUB=1` in `.env.local` — sticky, for a day spent on layout.
 *   - `?stub=1` — the `?gifs=stub` URL lever, forwarded by the client.
 *   - no `GIPHY_API_KEY` at all, outside production — a fresh clone should
 *     render a working picker before it renders an error.
 */

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 24

function sampleResponse(query: string, offset: number): GifSearchResponse {
  const q = query.trim().toLowerCase()
  const matched = q
    ? SAMPLE_GIFS.filter((gif) => gif.keywords.some((word) => word.includes(q)))
    : SAMPLE_GIFS
  // A search that matches nothing still returns the shelf rather than an empty
  // grid: there are only twelve of these, and a blank picker reads as broken.
  const results = matched.length > 0 ? matched : SAMPLE_GIFS
  return { results: [...results], offset: offset + results.length, query, source: 'sample' }
}

function clampLimit(raw: string | null): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT
  return Math.min(Math.floor(value), MAX_LIMIT)
}

export async function GET(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams
  const query = params.get('q') ?? ''
  const limit = clampLimit(params.get('limit'))
  const offset = Math.max(0, Number(params.get('offset')) || 0)

  const apiKey = process.env.GIPHY_API_KEY
  const production = process.env.NODE_ENV === 'production'
  const stubbed =
    process.env.GIFS_STUB === '1' || (!production && params.get('stub') === '1')

  if (stubbed || (!apiKey && !production)) {
    return NextResponse.json(sampleResponse(query, offset))
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GIF search isn’t configured. Set GIPHY_API_KEY and restart the server.' },
      { status: 500 },
    )
  }

  try {
    const results = await searchGiphy({ q: query, limit, offset }, apiKey)
    const body: GifSearchResponse = {
      results,
      offset: offset + results.length,
      query,
      source: 'giphy',
    }
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
    })
  } catch (error) {
    // The upstream status is worth having in the server log; the player only
    // needs to know what to do next.
    console.error('[api/gifs] upstream failed', error)
    return NextResponse.json(
      { error: 'Giphy isn’t answering. Try again — or let the clock pick for you.' },
      { status: 502 },
    )
  }
}
