'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react'
import type { ActionInput } from '@/lib/game/actions'
import type { RoomSnapshot, RoomStore } from './store'
import { shallowEqual } from './store'
import type { Unsubscribe } from './transport'

export interface RoomBinding {
  store: RoomStore
  send: (action: ActionInput) => void
  /** The room's clock, host skew already applied. Never put this in the store. */
  roomNow: () => number
  /** Fires when the host refuses something *this* player asked for. */
  onRefused: (listener: (reason: string) => void) => Unsubscribe
}

export const RoomContext = createContext<RoomBinding | undefined>(undefined)

function useBinding(): RoomBinding {
  const binding = useContext(RoomContext)
  if (!binding) throw new Error('useRoom must be used inside a <RoomProvider>')
  return binding
}

/** The whole snapshot. Prefer `useRoomSelector` on any screen with a list. */
export function useRoom(): RoomSnapshot & { send: (action: ActionInput) => void } {
  const binding = useBinding()
  const snapshot = useSyncExternalStore(
    binding.store.subscribe,
    binding.store.getSnapshot,
    binding.store.getServerSnapshot,
  )
  return { ...snapshot, send: binding.send }
}

export function useRoomSend(): (action: ActionInput) => void {
  return useBinding().send
}

export function useRoomNow(): () => number {
  return useBinding().roomNow
}

/**
 * Subscribe to one derived value.
 *
 * The vote screen renders up to twenty live cards, so a context value would
 * re-render all of them on every broadcast. The selector result is cached twice
 * over — once by snapshot identity, once by `isEqual` — because `standings()`,
 * `voteCards()` and `submissionRows()` each allocate a fresh array per call and
 * React 19 loops forever on a snapshot that is not referentially stable.
 *
 * Pass a **module-level** selector, not an inline closure: the cache is keyed on
 * snapshot identity, so a selector that changes meaning between renders would
 * be read from cache. That is also the house rule — named selectors, never an
 * inline ternary in a screen.
 */
export function useRoomSelector<T>(
  select: (snapshot: RoomSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = shallowEqual as (a: T, b: T) => boolean,
): T {
  const binding = useBinding()
  const cache = useRef<{ snapshot: RoomSnapshot; value: T } | undefined>(undefined)

  const read = useCallback((): T => {
    const snapshot = binding.store.getSnapshot()
    const cached = cache.current
    if (cached && cached.snapshot === snapshot) return cached.value

    const next = select(snapshot)
    if (cached && isEqual(cached.value, next)) {
      cache.current = { snapshot, value: cached.value }
      return cached.value
    }
    cache.current = { snapshot, value: next }
    return next
  }, [binding, select, isEqual])

  const readServer = useCallback((): T => select(binding.store.getServerSnapshot()), [
    binding,
    select,
  ])

  return useSyncExternalStore(binding.store.subscribe, read, readServer)
}

/**
 * Hear why the room said no.
 *
 * `authorize.ts` returns finished sentences — "You set this round up, so you
 * sit it out." — so the handler is normally just the snackbar. Kept as a
 * subscription rather than a value because a refusal is an event: it happens
 * once, and re-rendering it back into view later would be a lie.
 *
 * The handler is held in a ref so a screen can pass an inline closure without
 * resubscribing on every render.
 */
export function useRoomRefusal(handler: (reason: string) => void): void {
  const binding = useBinding()
  const ref = useRef(handler)

  // Kept current in an effect rather than during render: a ref written while
  // rendering is invisible to React's scheduling, and the subscription below
  // only ever reads it from a callback.
  useEffect(() => {
    ref.current = handler
  })

  useEffect(() => binding.onRefused((reason) => ref.current(reason)), [binding])
}
