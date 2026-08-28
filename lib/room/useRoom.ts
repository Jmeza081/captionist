'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import type { ActionInput } from '@/lib/game/actions'
import type { ChatEntry, EventSnapshot, EventStore, Tally } from './events'
import { tallyKey } from './events'
import type { RoomSnapshot, RoomStore } from './store'
import { shallowEqual } from './store'
import type {
  ChatAttachment,
  ChatQuote,
  ReactionTarget,
  RoomEvent,
  Unsubscribe,
} from './transport'

export interface RoomBinding {
  store: RoomStore
  send: (action: ActionInput) => void
  /** The room's clock, host skew already applied. Never put this in the store. */
  roomNow: () => number
  /** Fires when the host refuses something *this* player asked for. */
  onRefused: (listener: (reason: string) => void) => Unsubscribe
  /** Chat and reactions, which are never room state. */
  events: EventStore
  publish: (event: RoomEvent) => void
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

/* ---------------- The event lane ---------------- */

/**
 * One derived value out of the chat store.
 *
 * The same double cache `useRoomSelector` uses, and for the same reason: a
 * vote grid asks for tallies once per card, so a selector that allocated on
 * every call would re-render twenty cards each time anybody said anything.
 *
 * Pass a **module-level** selector, or one memoised on its own inputs.
 */
export function useEventSelector<T>(
  select: (snapshot: EventSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = shallowEqual as (a: T, b: T) => boolean,
): T {
  const binding = useBinding()
  const cache = useRef<{ snapshot: EventSnapshot; value: T } | undefined>(undefined)

  const read = useCallback((): T => {
    const snapshot = binding.events.getSnapshot()
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

  // **Cached, not recomputed.** React calls this during every server and
  // hydration render and warns — then loops — if it comes back with a fresh
  // object each time. `selectUnread` allocates one, so this is not theoretical.
  // The empty snapshot never changes, so one value per selector is enough.
  const server = useRef<{ select: unknown; value: T } | undefined>(undefined)
  const readServer = useCallback((): T => {
    const cached = server.current
    if (cached && cached.select === select) return cached.value
    const value = select(binding.events.getServerSnapshot())
    server.current = { select, value }
    return value
  }, [binding, select])

  return useSyncExternalStore(binding.events.subscribe, read, readServer)
}

const selectMessages = (snapshot: EventSnapshot): readonly ChatEntry[] => snapshot.messages

const selectUnread = (snapshot: EventSnapshot): { count: number; firstId: string | undefined } => ({
  count: snapshot.unread,
  firstId: snapshot.firstUnreadId,
})

/** Everything said in this room, oldest first. */
export function useChatLog(): readonly ChatEntry[] {
  return useEventSelector(selectMessages)
}

/** How much arrived while chat was shut, and where the divider goes. */
export function useUnread(): { count: number; firstId: string | undefined } {
  return useEventSelector(selectUnread)
}

const selectLastReaction = (snapshot: EventSnapshot) => snapshot.lastReaction

/** The newest reaction in the room, which is what the emoji burst fires on. */
export function useLastReaction(): { emoji: string; key: number } | null {
  return useEventSelector(selectLastReaction) ?? null
}

const NO_TALLIES: readonly Tally[] = []

/**
 * The running counts against one card or one message.
 *
 * The selector closes over its target, so it is memoised on that rather than
 * declared at module scope — the one exception to the rule above, and a safe
 * one because the closure reads a single key and nothing else.
 */
export function useTallies(target: ReactionTarget, targetId: string): readonly Tally[] {
  const select = useCallback(
    (snapshot: EventSnapshot) => snapshot.tallies[tallyKey(target, targetId)] ?? NO_TALLIES,
    [target, targetId],
  )
  return useEventSelector(select)
}

/** What rides along with a message besides the words. */
export interface SayExtras {
  attachment?: ChatAttachment
  replyTo?: ChatQuote
}

/** What the room does when you say something, or tap an emoji. */
export interface ChatApi {
  say: (text: string, extras?: SayExtras) => void
  react: (target: ReactionTarget, targetId: string, emoji: string) => void
  markRead: () => void
}

export function useChat(): ChatApi {
  const binding = useBinding()
  return useMemo(
    () => ({
      say: (text, extras) => {
        const body = text.trim()
        // The send-side twin of `receiveChat`'s guard: a GIF alone is a
        // message, a quote alone is not. If the two ever disagree, a player
        // watches a message leave and never arrive.
        if (!body && !extras?.attachment) return
        // `from` is overwritten by the transport with the identity it
        // authenticated — that is the whole point of the lane. It is filled in
        // here only so the type is satisfied at the call site.
        binding.publish({
          kind: 'chat',
          from: binding.store.getSnapshot().selfId,
          text: body,
          at: binding.roomNow(),
          ...(extras?.attachment ? { attachment: extras.attachment } : {}),
          ...(extras?.replyTo ? { replyTo: extras.replyTo } : {}),
        })
      },
      react: (target, targetId, emoji) => {
        binding.publish({
          kind: 'reaction',
          from: binding.store.getSnapshot().selfId,
          target,
          targetId,
          emoji,
          at: binding.roomNow(),
        })
      },
      markRead: () => binding.events.markRead(),
    }),
    [binding],
  )
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
