'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GifProviderError, GifQuotaError } from './errors'
import { descriptorFor } from './descriptors'
import { intendedProvider } from './registry'
import { fetchBoard, reportPick } from './source'
import { firstPage } from './provider'
import type { GifAd, GifCursor, GifProviderDescriptor } from './provider'
import type { GifResult, GifSearchResponse } from './types'

/**
 * GIF search for a screen.
 *
 * Calls the provider directly — there is no `/api/gifs` any more, and there is
 * no cache behind it either. Both were prohibited by Giphy; `giphy.ts` carries
 * the terms. Which provider answers is `source.ts`'s business, not this hook's:
 * all it needs is a board and a way to tell a spent allowance from a failed
 * request.
 *
 * **Searching is unmetered.** Every board is still a live API call, but a Klipy
 * production key does not charge for them, so the three-a-round budget this
 * hook used to keep is gone (ADR-0026). What survives it is `onExhausted`: a
 * 429 is no longer expected, and a picker that simply stopped working if one
 * arrived would be worse than the designed ending.
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
   * The provider's allowance is spent — a 429 came back.
   *
   * A callback rather than a `send` in here, so the hook stays ignorant of the
   * room — the screens own that, and a test can assert on a spy. Unmetered is
   * not infinite, so this outlived the budget that used to make it likely.
   */
  onExhausted?: () => void
}

export interface GifSearch {
  results: readonly GifResult[]
  /**
   * Ads that came with the current board. Usually none.
   *
   * Separate from `results` so nothing that picks a GIF can reach one. The
   * screens hand these to `GifPanel` and otherwise ignore them.
   */
  ads: readonly GifAd[]
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
  /**
   * Another board for the same query — the design's "Shuffle results".
   *
   * Turns the page rather than adding to it, which is what "shuffle" promises
   * and what the picker's scroll position wants. Wraps back to the first page
   * at the end of a thin result set, so the control never leaves somebody
   * looking at nothing. A no-op while a board is already in flight, and over
   * the offline shelf, which has no second page.
   */
  more: () => void
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
  /** Ask again for exactly what last failed — same query, same page. */
  retry: () => void
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

const TIMED_OUT = 'That took too long to load. Try again.'
const OFFLINE = 'Couldn’t reach the GIF library. Check your connection and try again.'
const FAILED = 'That search didn’t come back. Try again.'

/**
 * A sentence a player can act on, whatever the browser threw.
 *
 * Only *our* errors carry copy worth showing: `GifProviderError` says which
 * provider answered what. Everything the platform throws is raw — "Failed to
 * fetch", "The operation was aborted due to timeout" — and §5 says an error
 * names what happened and what to do next, which neither of those does to a
 * person holding a phone.
 */
function describe(error: unknown): string {
  if (error instanceof GifProviderError) return error.message
  if (error instanceof DOMException && error.name === 'TimeoutError') return TIMED_OUT
  // A dropped connection, a blocked host, a DNS miss: `fetch` rejects with a
  // bare `TypeError` for all of them.
  if (error instanceof TypeError) return OFFLINE
  return FAILED
}

export function useGifSearch(options?: GifSearchOptions): GifSearch {
  const enabled = options?.enabled ?? true
  const onExhausted = options?.onExhausted

  const [results, setResults] = useState<readonly GifResult[]>([])
  const [ads, setAds] = useState<readonly GifAd[]>([])
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

  const cursor = useRef<GifCursor | undefined>(undefined)
  // Whether spending that cursor would return anything, so `more` can wrap
  // instead of turning the page into an empty board.
  const hasMore = useRef(false)
  // Read by `chose`, which must keep a stable identity: the screens hand it to
  // click handlers, and an unstable one would churn them every render.
  const sourceRef = useRef<GifSearchResponse['source']>('sample')
  const queryRef = useRef('')
  const inFlight = useRef<AbortController | undefined>(undefined)
  // Monotonic: a response from an abandoned search must not overwrite a newer one.
  const latest = useRef(0)
  // Written where a board starts and cleared where one settles, never during
  // render. `more` reads it so a second tap cannot fire a second request while
  // the first is still out — and it is a ref rather than `status` so `more`
  // keeps a stable identity, the same reason `chose` does.
  const loading = useRef(false)

  const apply = useCallback((body: GifSearchResponse, ticket: number) => {
    if (ticket !== latest.current) return
    loading.current = false
    cursor.current = body.cursor
    hasMore.current = body.hasMore
    sourceRef.current = body.source
    queryRef.current = body.query
    setResults(body.results)
    setAds(body.ads)
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
    loading.current = false
    // A spent quota is not a failed search — it ends the game, and the screen
    // that owns the room says so.
    if (error instanceof GifQuotaError) {
      onExhaustedRef.current?.()
      return
    }
    setStatus('error')
    setMessage(describe(error))
  }, [])

  /** What was last asked for, so a failed board can be asked for again. */
  const lastAsk = useRef<{ query: string; from: GifCursor | undefined }>({
    query: '',
    from: undefined,
  })

  const run = useCallback(
    (next: string, from: GifCursor | undefined) => {
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      const ticket = ++latest.current
      lastAsk.current = { query: next, from }

      loading.current = true
      setStatus('loading')
      setQuery(next)

      void fetchBoard(next, from, LIMIT)
        .then((body) => apply(body, ticket))
        .catch((error: unknown) => fail(error, ticket, controller.signal))
    },
    [apply, fail],
  )

  // Trending on arrival, so the grid is never empty. Deliberately not routed
  // through `run`: state must only be set from the async continuation here,
  // never synchronously inside an effect.
  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    inFlight.current = controller
    const ticket = ++latest.current
    lastAsk.current = { query: '', from: undefined }
    loading.current = true

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

  /**
   * The next page of the same query, wrapping at the end.
   *
   * `cursor` already points at where the next page starts — `source.ts` mints
   * it that way — so this spends it rather than deriving one. When the last
   * board said there is no next page, it goes back to the first: a thin result
   * set should cycle, not dead-end on an empty grid.
   */
  const more = useCallback(() => {
    const from = cursor.current
    // Nothing to turn the page on yet, and the shelf has only the one.
    if (!from || sourceRef.current === 'sample') return
    if (loading.current) return
    run(queryRef.current, hasMore.current ? from : firstPage(from.provider))
  }, [run])

  const surprise = useCallback((): GifResult | undefined => {
    if (results.length === 0) return undefined
    // Local, not a fetch. `state.seed` only advances inside the reducer and
    // this is a per-viewer convenience, not room state.
    return results[Math.floor(Math.random() * results.length)]
  }, [results])

  /**
   * Ask again for exactly what failed.
   *
   * Not `search(query)`: that would restart from the first page, and a board
   * that timed out on "Shuffle results" should come back with the *next* page,
   * not the one the player already saw.
   */
  const retry = useCallback(() => {
    run(lastAsk.current.query, lastAsk.current.from)
  }, [run])

  return {
    results,
    ads,
    status,
    message,
    query,
    source,
    descriptor,
    setQuery,
    chose,
    search: (next: string) => run(next, undefined),
    more,
    surprise,
    retry,
  }
}
