'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GiphyRateLimitError } from './giphy'
import { fetchBoard } from './source'
import type { GifResult, GifSearchResponse } from './types'

/**
 * Giphy search for a screen.
 *
 * Calls Giphy directly — there is no `/api/gifs` any more, and there is no
 * cache behind it either. Both were prohibited; `giphy.ts` carries the terms.
 *
 * What that costs is a budget. Every board is a live API call against an
 * allowance of 100 an hour for the whole room, so a competitor gets
 * `SEARCHES_PER_ROUND` of them. **The board you land on is free** — arriving
 * at a picker is not a choice anyone made, and charging for it would mean the
 * counter opened at one less than it says. Reset is free too: `BriefScreen`
 * and `ComposeScreen` unmount between phases, so each round mounts a fresh
 * hook.
 *
 * No debounce, on purpose: the design's picker says "Enter to search", so a
 * request fires on submit and on a suggestion chip — which deletes the whole
 * debounce-and-race question. What is left is a stale-response guard, because
 * two searches in flight can still land out of order.
 */

export type GifStatus = 'loading' | 'ready' | 'error'

export interface GifSearchOptions {
  /**
   * Whether this screen actually shows a picker.
   *
   * Default `true`, so no existing call site changes meaning by accident. It
   * matters because the hook sits above the early returns that decide which
   * face of a phase you see: `BriefScreen` has four views and only one of them
   * draws a board, so without this every player in the room spent a call each
   * round while watching a "waiting for the Prompter" screen.
   */
  enabled?: boolean
  /**
   * The hourly allowance is gone.
   *
   * A callback rather than a `send` in here, so the hook stays ignorant of the
   * room — the screens own that, and a test can assert on a spy.
   */
  onExhausted?: () => void
}

export interface GifSearch {
  results: readonly GifResult[]
  status: GifStatus
  /** Set when something needs saying — an error, or "these are samples". */
  message?: string
  query: string
  /** Where the current board came from. The attribution mark reads this. */
  source: GifSearchResponse['source']
  /**
   * Type into the field.
   *
   * The field is controlled by `query` so a suggestion chip and a search both
   * land in it — which meant that without this it could not be typed in at
   * all: both boards passed a no-op change handler and the box was frozen.
   */
  setQuery: (query: string) => void
  search: (query: string) => void
  /** Searches left this round. Zero means the controls say so and stop firing. */
  remaining: number
  /**
   * One arbitrary GIF off the board you already have.
   *
   * Free, and synchronous. It used to fetch a random page, which was a whole
   * extra API call to show you something fifty tiles of already-loaded board
   * could answer.
   */
  surprise: () => GifResult | undefined
}

/**
 * Giphy's `limit` ceiling, and Klipy's `per_page`. Worth taking all of it: a
 * board of fifty costs exactly one call, the same as a board of twelve, and
 * every tile it adds is a search somebody now does not need to run.
 */
const LIMIT = 50

/**
 * Searches a competitor may run per round, on top of the free arrival board.
 *
 * So a round costs at most `1 + SEARCHES_PER_ROUND` calls a seat. At a full
 * ten-player `react` room over five rounds that ceiling is 180, which is over
 * the free tier's 100 an hour — a deliberate, recorded trade: the room is more
 * fun with room to hunt, running out is a designed ending rather than a broken
 * picker, and a production key is the answer if the game earns one. See
 * ADR-0021.
 */
export const SEARCHES_PER_ROUND = 3

const FAILED = 'That search didn’t come back. Try again.'

export function useGifSearch(options?: GifSearchOptions): GifSearch {
  const enabled = options?.enabled ?? true
  const onExhausted = options?.onExhausted

  const [results, setResults] = useState<readonly GifResult[]>([])
  // A disabled hook is not loading anything, and claiming otherwise would
  // render "Looking…" forever on a screen that never draws a picker.
  const [status, setStatus] = useState<GifStatus>(enabled ? 'loading' : 'ready')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<GifSearchResponse['source']>('giphy')
  const [spent, setSpent] = useState(0)

  const offset = useRef(0)
  const inFlight = useRef<AbortController | undefined>(undefined)
  // Monotonic: a response from an abandoned search must not overwrite a newer one.
  const latest = useRef(0)
  // The budget is decided from a ref and displayed from state. Two clicks in
  // the same tick both read the same stale state; they cannot both read a ref
  // that the first one already incremented.
  const spentRef = useRef(0)

  /** Take a search if there is one left. */
  const spend = useCallback((): boolean => {
    if (spentRef.current >= SEARCHES_PER_ROUND) return false
    spentRef.current += 1
    setSpent(spentRef.current)
    return true
  }, [])

  const apply = useCallback((body: GifSearchResponse, ticket: number) => {
    if (ticket !== latest.current) return
    offset.current = body.offset
    setResults(body.results)
    setQuery(body.query)
    setSource(body.source)
    setStatus('ready')
    setMessage(
      body.source === 'sample' ? 'Showing samples — no Giphy key configured.' : undefined,
    )
  }, [])

  /**
   * Held in a ref so `fail` never changes identity.
   *
   * Callers write it inline — `onExhausted: () => send(...)` — which is a new
   * function every render. As a dependency that made `fail` unstable, which
   * made the mount effect's dependencies unstable, which re-ran the effect on
   * *every render*: arriving on the brief screen fired seven trending
   * requests instead of one. The budget still only paid for the first, so
   * nothing on screen looked wrong; only counting the calls found it.
   */
  const onExhaustedRef = useRef(onExhausted)
  useEffect(() => {
    onExhaustedRef.current = onExhausted
  })

  const fail = useCallback((error: unknown, ticket: number, signal: AbortSignal) => {
    if (signal.aborted || ticket !== latest.current) return
    // A spent quota is not a failed search — it ends the game, and the screen
    // that owns the room says so.
    if (error instanceof GiphyRateLimitError) {
      onExhaustedRef.current?.()
      return
    }
    setStatus('error')
    setMessage(error instanceof Error ? error.message : FAILED)
  }, [])

  const run = useCallback(
    (next: string, nextOffset: number) => {
      if (!spend()) return

      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      const ticket = ++latest.current

      setStatus('loading')
      setQuery(next)

      void fetchBoard(next, nextOffset, LIMIT)
        .then((body) => apply(body, ticket))
        .catch((error: unknown) => fail(error, ticket, controller.signal))
    },
    [apply, fail, spend],
  )

  // Trending on arrival, so the grid is never empty. Deliberately not routed
  // through `run`: state must only be set from the async continuation here,
  // never synchronously inside an effect.
  useEffect(() => {
    if (!enabled) return

    // No `spend()` here, deliberately: arriving is free.
    const controller = new AbortController()
    inFlight.current = controller
    const ticket = ++latest.current

    void fetchBoard('', 0, LIMIT)
      .then((body) => apply(body, ticket))
      .catch((error: unknown) => fail(error, ticket, controller.signal))

    return () => controller.abort()
  }, [enabled, apply, fail])

  const surprise = useCallback((): GifResult | undefined => {
    if (results.length === 0) return undefined
    // Local, not a fetch. `state.seed` only advances inside the reducer and
    // this is a per-viewer convenience, not room state.
    return results[Math.floor(Math.random() * results.length)]
  }, [results])

  return {
    results,
    status,
    message,
    query,
    source,
    setQuery,
    search: (next: string) => run(next, 0),
    remaining: Math.max(0, SEARCHES_PER_ROUND - spent),
    surprise,
  }
}
