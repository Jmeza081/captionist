import type { PlayerId, PublicState } from '@/lib/game/types'
import type { TransportStatus, Unsubscribe } from './transport'

/**
 * The external store screens subscribe to.
 *
 * Two constraints, both load-bearing:
 *
 * 1. **`getSnapshot` must return a stable reference** between real changes.
 *    React 19 re-reads it during render and infinite-loops if it allocates, so
 *    the snapshot object is rebuilt only when something in it actually changed.
 * 2. **Nothing time-varying lives in the snapshot.** `roomNow()` would change
 *    on every call and re-enter that same loop, so clock skew is read through
 *    a function instead. The visible countdown is a hook that touches no store
 *    state at all.
 */
export interface RoomSnapshot {
  readonly state: PublicState | undefined
  readonly status: TransportStatus
  readonly selfId: PlayerId
  readonly isHost: boolean
  /**
   * Why the room never opened at all.
   *
   * Distinct from `status`, which is a connection that exists and is unwell.
   * This is a room that could not be built — no realtime configured, most
   * likely — and without it that case renders as "Joining the room…" forever,
   * which is the one thing a misconfigured server must not do.
   */
  readonly error?: string
}

export interface RoomStore {
  subscribe(listener: () => void): Unsubscribe
  getSnapshot(): RoomSnapshot
  /** SSR renders the empty room; without this `useSyncExternalStore` throws. */
  getServerSnapshot(): RoomSnapshot
  setState(state: PublicState): void
  setStatus(status: TransportStatus): void
  /**
   * Who this tab turned out to be.
   *
   * Both were constructor arguments while every tab hosted its own room. They
   * are no longer knowable at mount: `isHost` is the answer to a claim probe
   * that has not resolved yet, and a tab whose id collides with another's takes
   * a suffixed one. Screens read both, so the store has to be able to learn
   * them rather than be told at birth.
   */
  setIdentity(selfId: PlayerId, isHost: boolean): void
  setError(error: string): void
}

export function createRoomStore(selfId: PlayerId, isHost: boolean): RoomStore {
  let snapshot: RoomSnapshot = {
    state: undefined,
    status: 'connecting',
    selfId,
    isHost,
  }
  const server = snapshot
  const listeners = new Set<() => void>()

  const emit = () => {
    for (const listener of [...listeners]) listener()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => server,
    setState(state) {
      if (snapshot.state === state) return
      snapshot = { ...snapshot, state }
      emit()
    },
    setStatus(status) {
      if (snapshot.status === status) return
      snapshot = { ...snapshot, status }
      emit()
    },
    setError(error) {
      if (snapshot.error === error) return
      snapshot = { ...snapshot, error }
      emit()
    },
    setIdentity(nextSelfId, nextIsHost) {
      if (snapshot.selfId === nextSelfId && snapshot.isHost === nextIsHost) return
      snapshot = { ...snapshot, selfId: nextSelfId, isHost: nextIsHost }
      emit()
    },
  }
}

/**
 * Default equality for selector results.
 *
 * `standings()`, `voteCards()` and `submissionRows()` all allocate a fresh
 * array every call, so referential equality would report a change on every
 * broadcast and re-render up to twenty live cards. One level deep is enough:
 * the elements themselves are rebuilt from immutable state.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, i) => Object.is(item, b[i]))
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a as Record<string, unknown>)
  const kb = Object.keys(b as Record<string, unknown>)
  if (ka.length !== kb.length) return false
  return ka.every((k) =>
    Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  )
}
