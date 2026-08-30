'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readLevers } from '@/lib/room/levers'
import type { GifResult, GifSearchResponse } from './types'

/**
 * Giphy search for a screen.
 *
 * No debounce, on purpose: the design's picker says "Enter to search", so a
 * request fires on submit and on a suggestion chip — which deletes the whole
 * debounce-and-race question. What is left is a stale-response guard, because
 * two searches in flight can still land out of order.
 */

export type GifStatus = 'loading' | 'ready' | 'error'

export interface GifSearch {
  results: readonly GifResult[]
  status: GifStatus
  /** Set when something needs saying — an error, or "these are samples". */
  message?: string
  query: string
  /**
   * Type into the field.
   *
   * The field is controlled by `query` so a suggestion chip and a search both
   * land in it — which meant that without this it could not be typed in at
   * all: both boards passed a no-op change handler and the box was frozen.
   */
  setQuery: (query: string) => void
  search: (query: string) => void
  /** Next page of the same query. */
  shuffle: () => void
  /** One arbitrary GIF, staged immediately. */
  surprise: () => Promise<GifResult | undefined>
}

const LIMIT = 12
const FAILED = 'That search didn’t come back. Try again.'

function stubbed(): boolean {
  if (typeof window === 'undefined') return false
  // The same gate as every other lever: absent in a production build.
  return readLevers(new URLSearchParams(window.location.search)).gifs === 'stub'
}

function endpoint(query: string, offset: number): string {
  const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
  if (query) params.set('q', query)
  if (stubbed()) params.set('stub', '1')
  return `/api/gifs?${params.toString()}`
}

async function fetchGifs(
  query: string,
  offset: number,
  signal: AbortSignal,
): Promise<GifSearchResponse> {
  const response = await fetch(endpoint(query, offset), { signal })
  const body = (await response.json()) as GifSearchResponse & { error?: string }
  if (!response.ok) throw new Error(body.error ?? FAILED)
  return body
}

export function useGifSearch(): GifSearch {
  const [results, setResults] = useState<readonly GifResult[]>([])
  // Starts loading: the mount fetch is already in flight, and claiming idle
  // for a frame would flash an empty grid.
  const [status, setStatus] = useState<GifStatus>('loading')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')

  const offset = useRef(0)
  const inFlight = useRef<AbortController | undefined>(undefined)
  // Monotonic: a response from an abandoned search must not overwrite a newer one.
  const latest = useRef(0)

  const apply = useCallback((body: GifSearchResponse, ticket: number) => {
    if (ticket !== latest.current) return
    offset.current = body.offset
    setResults(body.results)
    setQuery(body.query)
    setStatus('ready')
    setMessage(
      body.source === 'sample' ? 'Showing samples — no Giphy key configured.' : undefined,
    )
  }, [])

  const fail = useCallback((error: unknown, ticket: number, signal: AbortSignal) => {
    if (signal.aborted || ticket !== latest.current) return
    setStatus('error')
    setMessage(error instanceof Error ? error.message : FAILED)
  }, [])

  const run = useCallback(
    (next: string, nextOffset: number) => {
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      const ticket = ++latest.current

      setStatus('loading')
      setQuery(next)

      void fetchGifs(next, nextOffset, controller.signal)
        .then((body) => apply(body, ticket))
        .catch((error: unknown) => fail(error, ticket, controller.signal))
    },
    [apply, fail],
  )

  // Trending on arrival, so the grid is never empty. Deliberately not routed
  // through `run`: state must only be set from the async continuation here,
  // never synchronously inside an effect.
  useEffect(() => {
    const controller = new AbortController()
    inFlight.current = controller
    const ticket = ++latest.current

    void fetchGifs('', 0, controller.signal)
      .then((body) => apply(body, ticket))
      .catch((error: unknown) => fail(error, ticket, controller.signal))

    return () => controller.abort()
  }, [apply, fail])

  const surprise = useCallback(async (): Promise<GifResult | undefined> => {
    // A random page of trending rather than the room's PRNG: `state.seed` only
    // advances inside the reducer, and this is a local convenience, not room state.
    const page = Math.floor(Math.random() * 5) * LIMIT
    const controller = new AbortController()
    const ticket = ++latest.current
    try {
      const body = await fetchGifs('', page, controller.signal)
      if (body.results.length > 0) apply(body, ticket)
      return body.results[0]
    } catch {
      return undefined
    }
  }, [apply])

  return {
    results,
    status,
    message,
    query,
    setQuery,
    search: (next: string) => run(next, 0),
    shuffle: () => run(query, offset.current),
    surprise,
  }
}
