'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionInput } from '@/lib/game/actions'
import { createRoom } from '@/lib/game/create'
import { fixtureFor } from '@/lib/game/fixtures'
import type { GameState, RoomCode } from '@/lib/game/types'
import { BotDriver } from './BotDriver'
import { GuestClient } from './GuestClient'
import { HostEngine } from './HostEngine'
import { LocalBus, createLocalTransport } from './LocalTransport'
import { createAutopilot } from './autopilot'
import { readLevers } from './levers'
import { createRoomStore } from './store'
import { RoomContext, type RoomBinding } from './useRoom'

/**
 * Constructs the room and hands screens a store to subscribe to.
 *
 * Phase 5 changes exactly one thing in this file: which transport is built.
 * Nothing above `useRoom()` knows a transport exists, which is the whole reason
 * the spine was built before the screens.
 *
 * Today the local player is always the host, because joining a room someone
 * else opened is phase 4. `?bots=` fills the other seats.
 */

const HOST_ID = 'p0'
const HOST_NAME = 'You'
const SNAPSHOT_PREFIX = 'captionist:room:'

export interface RoomProviderProps {
  roomCode: RoomCode
  /** The page's `searchParams`, already resolved. */
  search?: Record<string, string | string[] | undefined>
  children: ReactNode
}

function toSearchParams(search: RoomProviderProps['search']): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search ?? {})) {
    if (typeof value === 'string') params.set(key, value)
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0])
  }
  return params
}

/**
 * Host authority's accepted cost: if the host's tab dies, the room dies.
 *
 * A lid closing or a phone locking is routine rather than exceptional, so the
 * snapshot is written on every revision and read back on mount. It does not
 * survive the tab being closed on purpose — `sessionStorage` is per-tab by
 * design, which is what stops a stale room resurrecting in an unrelated one.
 */
function saveSnapshot(code: RoomCode, state: GameState): void {
  try {
    sessionStorage.setItem(SNAPSHOT_PREFIX + code, JSON.stringify(state))
  } catch {
    // A private window or a full quota. Losing the snapshot is survivable;
    // failing the render over it is not.
  }
}

function loadSnapshot(code: RoomCode): GameState | undefined {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_PREFIX + code)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const candidate = parsed as GameState
    return typeof candidate.rev === 'number' && candidate.roomCode === code
      ? candidate
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Move a fixture's deadline onto the real clock.
 *
 * `lib/game/fixtures.ts` stamps its actions at a fixed fake epoch so the data is
 * reproducible. That makes any running clock in a fixture already expired the
 * instant it boots, and the engine — correctly — fires `clock/expired` at once
 * and stampedes through every phase. `?phase=vote` would show a tiebreak.
 *
 * So the deadline is rebased, not the history: timestamps already in the past
 * are data, but a *deadline* in the past is a lie about the room's future.
 */
function rebaseClock(state: GameState, now: number): GameState {
  if (state.clock.status !== 'running') return state
  return { ...state, clock: { ...state.clock, endsAt: now + state.clock.totalMs } }
}

export function RoomProvider({ roomCode, search, children }: RoomProviderProps) {
  const [store] = useState(() => createRoomStore(HOST_ID, true))
  const engineRef = useRef<HostEngine | undefined>(undefined)
  const guestRef = useRef<GuestClient | undefined>(undefined)

  const levers = useMemo(() => readLevers(toSearchParams(search)), [search])

  useEffect(() => {
    const bus = new LocalBus(roomCode, { latencyMs: 80, jitterMs: 40 })
    const hostTransport = createLocalTransport({ bus, selfId: HOST_ID, isHost: true })

    const restored = loadSnapshot(roomCode)
    const fresh =
      levers.phase !== undefined
        ? rebaseClock(
            fixtureFor(levers.phase, {
              // A fixture needs a populated room whether or not bots drive it —
              // `?phase=vote` alone is how a screen gets reviewed in isolation.
              players: levers.bots !== undefined ? levers.bots + 1 : 5,
              seed: levers.seed,
            }),
            Date.now(),
          )
        : createRoom({
            roomCode,
            host: { id: HOST_ID, name: HOST_NAME, avatarSeed: HOST_ID },
            seed: levers.seed ?? Math.floor(Math.random() * 2 ** 31),
            at: Date.now(),
          })
    // Prefer whichever is further along: a reload mid-game should not restart it.
    const initial = restored && restored.rev > fresh.rev ? restored : fresh

    const engine = new HostEngine({
      transport: hostTransport,
      initial,
      fast: levers.fast,
      onChange: (state) => saveSnapshot(roomCode, state),
    })
    engineRef.current = engine

    // The host is a player too, so it needs the same state feed a guest gets.
    const hostClient = new GuestClient({
      transport: hostTransport,
      onState: (state) => store.setState(state),
      onStatus: (status) => store.setStatus(status),
    })
    hostClient.start()
    guestRef.current = hostClient

    const bots: Array<() => void> = []
    for (let i = 1; i <= (levers.bots ?? 0); i++) {
      const id = `p${i}`
      const transport = createLocalTransport({ bus, selfId: id, isHost: false })
      const bot = new BotDriver({
        id,
        name: `Bot ${i}`,
        index: i,
        send: (action) => transport.sendIntent(action),
      })
      const client = new GuestClient({ transport, onState: (s) => bot.observe(s) })
      client.start()
      bots.push(() => {
        client.stop()
        transport.close()
      })
    }

    // Only autopilot a room that has bots in it: with real people, those taps
    // are the host's, and phase 2 gives them buttons.
    if (levers.bots) {
      const autopilot = createAutopilot({ engine, waitFor: levers.bots + 1 })
      const off = hostTransport.onState((state) => autopilot(state))
      bots.push(off)
    }

    engine.start()

    // A throttled background tab stops firing timers, and guests must never
    // self-advance — so the room would silently freeze at 0:00 without this.
    const onVisible = () => engine.catchUp()
    const onUnload = () => engine.apply({ type: 'host/left' }, HOST_ID)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('beforeunload', onUnload)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('beforeunload', onUnload)
      for (const stop of bots) stop()
      hostClient.stop()
      engine.stop()
      hostTransport.close()
      bus.close()
      engineRef.current = undefined
      guestRef.current = undefined
    }
  }, [roomCode, levers, store])

  const binding = useMemo<RoomBinding>(
    () => ({
      store,
      send: (action: ActionInput) => {
        engineRef.current?.apply(action, HOST_ID)
      },
      roomNow: () => guestRef.current?.roomNow() ?? Date.now(),
    }),
    [store],
  )

  return <RoomContext.Provider value={binding}>{children}</RoomContext.Provider>
}
