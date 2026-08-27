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
 * The local player is normally the host, because joining a room someone else
 * opened is phase 4. `?bots=` fills the other seats, and `?as=` sits you in one
 * of them — the first real use of the guest path.
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
  const levers = useMemo(() => readLevers(toSearchParams(search)), [search])

  /**
   * `?as=` only means anything against a fixture, where the seat already
   * exists. In a fresh room the seats are empty until someone joins, and
   * joining is phase 4's problem — so this falls back to the host rather than
   * putting you in a chair nobody is sitting in.
   */
  const selfId = levers.phase !== undefined && levers.as ? levers.as : HOST_ID
  const isHost = selfId === HOST_ID

  const [store] = useState(() => createRoomStore(selfId, isHost))
  const engineRef = useRef<HostEngine | undefined>(undefined)
  const guestRef = useRef<GuestClient | undefined>(undefined)
  const refusalListeners = useRef(new Set<(reason: string) => void>())

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
              settings: levers.mode ? { mode: levers.mode } : undefined,
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
      // Only *our* refusals are worth a snackbar. A bot being told to sit a
      // round out is the harness working, not something to interrupt over.
      onRefused: (intent, reason) => {
        if (intent.from !== selfId) return
        for (const listener of [...refusalListeners.current]) listener(reason)
      },
    })
    engineRef.current = engine

    // The host is a player too, so it needs the same state feed a guest gets.
    // Under `?as=` the local endpoint is a genuine guest instead: its own
    // transport, its own seat, and intents that travel the same road a real
    // guest's will in phase 4.
    const selfTransport = isHost
      ? hostTransport
      : createLocalTransport({ bus, selfId, isHost: false })

    const selfClient = new GuestClient({
      transport: selfTransport,
      onState: (state) => store.setState(state),
      onStatus: (status) => store.setStatus(status),
    })
    selfClient.start()
    guestRef.current = selfClient

    const bots: Array<() => void> = []
    for (let i = 1; i <= (levers.bots ?? 0); i++) {
      const id = `p${i}`
      // Two drivers in one chair would submit twice and vote against itself.
      if (id === selfId) continue
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
      selfClient.stop()
      if (!isHost) selfTransport.close()
      engine.stop()
      hostTransport.close()
      bus.close()
      engineRef.current = undefined
      guestRef.current = undefined
    }
  }, [roomCode, levers, store, selfId, isHost])

  const binding = useMemo<RoomBinding>(
    () => ({
      store,
      /**
       * Deliberately over the transport rather than straight into the engine.
       *
       * `engine.apply()` skips authorisation feedback — it only reports a
       * refusal when it can name the intent that caused it — and it resolves
       * in the same tick, which is exactly the shortcut the transport's
       * artificial latency exists to prevent. Going through `sendIntent` gives
       * the host the same round trip a guest gets, so a screen that works here
       * works in phase 5.
       */
      send: (action: ActionInput) => {
        guestRef.current?.send(action)
      },
      roomNow: () => guestRef.current?.roomNow() ?? Date.now(),
      onRefused: (listener) => {
        refusalListeners.current.add(listener)
        return () => refusalListeners.current.delete(listener)
      },
    }),
    [store],
  )

  return <RoomContext.Provider value={binding}>{children}</RoomContext.Provider>
}
