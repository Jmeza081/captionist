'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GifQuotaError } from './errors'
import { descriptorFor } from './descriptors'
import { intendedProvider } from './registry'
import { fetchBoard, reportPick } from './source'
import type { GifCursor, GifProviderDescriptor } from './provider'
import type { GifResult, GifSearchResponse } from './types'

/**
 * GIF search for a screen.
 *
 * Calls the provider directly — there is no `/api/gifs` any more, and there is
 * no cache behind it either. Both were prohibited by Giphy; `giphy.ts` carries
 * the terms. Which provider answers is `source.ts`'s business, not this hook's:
 * all it needs is a board, a budget, and a way to tell a spent allowance from a
 * failed request.
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
  /** Where the current board came from. `sample` is the offline shelf. */
  source: GifSearchResponse['source']
  /**
   * Who supplied the current board, or `undefined` over the offline shelf.
   *
   * The picker's attribution mark renders from this, so "never credit anyone
   * over the shelf" is a fact about the value rather than a comparison somebody
   * has to remember to write.
   */
  descriptor: GifProviderDescriptor | undefined
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
   * Say that this GIF was the one.
   *
   * Klipy's attribution depends on hearing about a pick, and this is the only
   * moment it can be said: `toMediaRef` drops the id immediately afterwards,
   * and the id is what the trigger takes. Fire-and-forget by design — a pick
   * must never fail because an analytics ping did.
   */
  chose: (gif: GifResult) => void
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
 *
 * `fetchBoard` clamps this to whatever the selected provider actually allows,
 * so asking for the ceiling here is a request, not an assumption.
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
  const [source, setSource] = useState<GifSearchResponse['source']>(
    () => intendedProvider().descriptor.id,
  )
  // Before the first board lands there is nothing to credit, and claiming a
  // provider that has not answered yet is the same mistake in miniature.
  const [descriptor, setDescriptor] = useState<GifProviderDescriptor | undefined>(undefined)
  const [spent, setSpent] = useState(0)

  const cursor = useRef<GifCursor | undefined>(undefined)
  // Read by `chose`, which must keep a stable identity: the screens hand it to
  // click handlers, and an unstable one would churn them every render.
  const sourceRef = useRef<GifSearchResponse['source']>('sample')
  const queryRef = useRef('')
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
    cursor.current = body.cursor
    sourceRef.current = body.source
    queryRef.current = body.query
    setResults(body.results)
    setQuery(body.query)
    setSource(body.source)
    /**
     * Whoever actually answered — read off the response, never off the config.
     *
     * The two look interchangeable and are not: `?gifs=klipy` pins a provider
     * for one page load without changing the environment, so asking the
     * environment put Giphy's mark under a board of Klipy's GIFs. Nobody's
     * brand over the offline shelf, which `descriptorFor` returns nothing for.
     */
    setDescriptor(descriptorFor(body.source))
    setStatus('ready')
    setMessage(
      body.source === 'sample'
        ? intendedProvider().descriptor.sampleFallbackMessage
        : undefined,
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
    if (error instanceof GifQuotaError) {
      onExhaustedRef.current?.()
      return
    }
    setStatus('error')
    setMessage(error instanceof Error ? error.message : FAILED)
  }, [])

  const run = useCallback(
    (next: string, from: GifCursor | undefined) => {
      if (!spend()) return

      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      const ticket = ++latest.current

      setStatus('loading')
      setQuery(next)

      void fetchBoard(next, from, LIMIT)
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

    void fetchBoard('', undefined, LIMIT)
      .then((body) => apply(body, ticket))
      .catch((error: unknown) => fail(error, ticket, controller.signal))

    return () => controller.abort()
  }, [enabled, apply, fail])

  const chose = useCallback(
    (gif: GifResult) => {
      reportPick(sourceRef.current, gif.id, queryRef.current)
    },
    [],
  )

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
    descriptor,
    setQuery,
    chose,
    search: (next: string) => run(next, undefined),
    remaining: Math.max(0, SEARCHES_PER_ROUND - spent),
    surprise,
  }
}
