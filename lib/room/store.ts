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
/**
 * How far the room has got towards existing.
 *
 * Four values because four things actually happen — the seat probe, the claim,
 * the wait for a first broadcast, and (a guest's alone) the wait to be seated.
 * There is no `ready`: being seated is a fact about `state` and `selfId`, so
 * `isSeated` derives it rather than a fifth stamp that could disagree.
 * Nothing here is invented to fill a gap: see `bootTimeline`, which paces what
 * is real rather than adding to it.
 */
export type BootStage = 'probing' | 'claiming' | 'waiting' | 'seating'

export interface BootProgress {
  readonly stage: BootStage
  /**
   * Which interstitial to draw. Seeded from what this tab *meant* to do — a
   * tab arriving from `/host` carries its pending settings — and corrected the
   * moment the claim answers. Without the seed a host opens on the guest's
   * screen and flips a beat later, because nobody knows who hosts until the
   * election resolves.
   */
  readonly role: 'host' | 'guest'
  /**
   * A boot that stopped, in a sentence.
   *
   * Distinct from `error`, which is a room that could never have existed. This
   * one is a room that exists and would not have us — a full room refusing a
   * seat, most likely, whose refusal has no snackbar to land in while the
   * interstitial is still up.
   */
  readonly failure?: string
}

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
   * likely. Without it that case spins on the boot screen forever, which is
   * the one thing a misconfigured server must not do; with it, the screen
   * says so where `boot.failure` would. See `RoomBootScreen`.
   */
  readonly error?: string
  readonly boot: BootProgress
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
  /** Where the boot has got to. Merged, so a stage stamp can't clear a role. */
  setBoot(patch: Partial<BootProgress>): void
}

export function createRoomStore(
  selfId: PlayerId,
  isHost: boolean,
  role: BootProgress['role'] = 'guest',
): RoomStore {
  let snapshot: RoomSnapshot = {
    state: undefined,
    status: 'connecting',
    selfId,
    isHost,
    boot: { stage: 'probing', role },
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
    setBoot(patch) {
      const next = { ...snapshot.boot, ...patch }
      // Same contract as every other setter: `getSnapshot` must return a stable
      // reference between real changes, and React 19 re-reads it during render.
      if (
        next.stage === snapshot.boot.stage &&
        next.role === snapshot.boot.role &&
        next.failure === snapshot.boot.failure
      ) {
        return
      }
      snapshot = { ...snapshot, boot: next }
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
 * Is this tab actually *in* the room yet?
 *
 * The boot is not over when the first broadcast lands — that only proves the
 * room exists. A guest still has to ask for a seat and be given one, and until
 * they are, the lobby would draw a roster they are not on. So both the screen's
 * hand-off and the refusal path read this one predicate, and cannot disagree
 * about what "joined" means.
 *
 * True for a host on their first broadcast: `createRoom` seats them.
 */
export function isSeated(snapshot: RoomSnapshot): boolean {
  const { state, selfId } = snapshot
  return state !== undefined && state.players.some((player) => player.id === selfId)
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
