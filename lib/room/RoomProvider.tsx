'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionInput } from '@/lib/game/actions'
import { HOST_FALLBACK_NAME } from '@/lib/game/constants'
import { createRoom } from '@/lib/game/create'
import { fixtureFor } from '@/lib/game/fixtures'
import type { GameState, RoomCode, RoomSettings } from '@/lib/game/types'
import { DEFAULT_DIFFICULTY } from '@/lib/bots/personas'
import { BotPool } from './BotPool'
import { connectRoom, probeRealtime, RoomUnavailable } from './connect'
import { GuestClient } from './GuestClient'
import { HostEngine } from './HostEngine'
import { createAutopilot } from './autopilot'
import { createEventStore } from './events'
import { ensureIdentity, type Identity } from './identity'
import { readLevers, type Levers } from './levers'
import { clearPendingSettings, readPendingSettings } from './pendingSettings'
import { createRoomStore, isSeated, type BootProgress } from './store'
import type { RoomTransport } from './transport'
import { RoomContext, type RoomBinding } from './useRoom'

/**
 * Constructs the room and hands screens a store to subscribe to.
 *
 * **This tab does not know whether it is the host until it asks.** It claims
 * the room code on the transport; silence means the room is ours, an answer
 * means somebody else opened it and we are a guest. Everything downstream —
 * whether an engine exists, whether bots attach, what `beforeunload` sends —
 * hangs off that one answer.
 *
 * The dev harness is the exception, and deliberately so: `?phase=` boots a
 * fixture that *is* the room, so it declares itself host rather than asking.
 * That keeps every harness URL behaving exactly as it did before joining
 * existed, which is the only way the claim path can be added without
 * disturbing the suite that guards everything else.
 *
 * Nothing above `useRoom()` knows a transport exists, which is why phase 5 is
 * still one line here: which implementation `connect` builds.
 */

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

/**
 * The fixture's own host seat.
 *
 * `lib/game/fixtures.ts` builds its rooms with `p0` at the head of the roster,
 * so a harness tab has to answer to that id to be the host of the room it just
 * manufactured — its `localStorage` identity is irrelevant there.
 */
/**
 * The room settings the URL asked for.
 *
 * Three levers feed one partial, built once rather than inline at both room
 * constructors — the fixture path and the fresh-room path. Inline, `?mode=`
 * was spelled out twice and the next lever would have reached only one of them.
 * `undefined` when nothing was asked for, so the room keeps its defaults.
 */
function leverSettings(levers: Levers): Partial<RoomSettings> | undefined {
  const settings: Partial<RoomSettings> = {}
  if (levers.mode) settings.mode = levers.mode
  if (levers.voting) settings.voting = levers.voting
  if (levers.format) settings.format = levers.format
  return Object.keys(settings).length > 0 ? settings : undefined
}

const FIXTURE_HOST_ID = 'p0'

/** Who this tab plays as, and whether it is allowed to skip the claim. */
interface Seat {
  identity: Identity
  /** The id the *host engine's* endpoint answers to. */
  hostId: string
  /** A fixture is the room, so it never asks whether one already exists. */
  declared: boolean
}

function resolveSeat(levers: Levers): Seat {
  if (levers.phase !== undefined) {
    // `?as=` sits in a seat the fixture already populated. Without it the tab
    // is the fixture's host.
    const id = levers.as ?? FIXTURE_HOST_ID
    return {
      identity: { id, name: HOST_FALLBACK_NAME, avatarSeed: id },
      hostId: FIXTURE_HOST_ID,
      declared: true,
    }
  }
  const identity = ensureIdentity()
  return { identity, hostId: identity.id, declared: false }
}

/**
 * Which interstitial to open on, before anybody knows who hosts.
 *
 * The claim probe is the authority and it takes 180ms on the tab transport,
 * 400ms of settle on Ably — long enough that a host seeded as a guest opens on
 * "Joining the room" and flips. So the *intent* seeds it and the claim
 * corrects it, from two signals that are already synchronous at mount: a
 * fixture declares itself the room, and a tab arriving from `/host` left its
 * chosen settings in `sessionStorage` on the way out.
 *
 * Peeked, never consumed — `startAsHost` still owns clearing them.
 */
function intendedRole(seat: Seat): BootProgress['role'] {
  if (seat.declared) return 'host'
  return readPendingSettings() ? 'host' : 'guest'
}

export function RoomProvider({ roomCode, search, children }: RoomProviderProps) {
  const levers = useMemo(() => readLevers(toSearchParams(search)), [search])
  const seat = useMemo(() => resolveSeat(levers), [levers])
  const selfId = seat.identity.id

  // `isHost` starts false and is corrected the moment the claim resolves: a tab
  // that assumed it was hosting would flash the host's controls at a guest.
  const [store] = useState(() => createRoomStore(selfId, false, intendedRole(seat)))
  /**
   * Chat and reactions, in their own store beside the room's.
   *
   * Both of its callbacks read `store` rather than closing over a value: this
   * tab does not know its own seat until the claim resolves, and the roster it
   * checks a sender against changes on every broadcast.
   */
  const [events] = useState(() =>
    createEventStore({
      self: () => store.getSnapshot().selfId,
      isMember: (from) =>
        store.getSnapshot().state?.players.some((p) => p.id === from) ?? false,
      // Announcements only. Read off the projection every tab already holds,
      // so no tab has to be told who hosts.
      isRoomHost: (from) => store.getSnapshot().state?.hostId === from,
    }),
  )
  const engineRef = useRef<HostEngine | undefined>(undefined)
  const guestRef = useRef<GuestClient | undefined>(undefined)
  /**
   * The bots this room has hired, so a screen can hire another.
   *
   * A ref rather than state: nothing re-renders when a bot is seated — the
   * roster updates because the engine broadcast a new state, which is the same
   * road a person joining takes.
   */
  const poolRef = useRef<BotPool | undefined>(undefined)
  /** The endpoint events are published from — this player's own, host or guest. */
  const selfTransportRef = useRef<RoomTransport | undefined>(undefined)
  const refusalListeners = useRef(new Set<(reason: string) => void>())

  const announce = (reason: string) => {
    for (const listener of [...refusalListeners.current]) listener(reason)
  }

  useEffect(() => {
    let cancelled = false
    const cleanups: Array<() => void> = []

    // A fixture is a local room by construction, so no lever may drag it onto
    // a shared network — see the note in the connect block below.
    const roomLevers = seat.declared ? { ...levers, transport: 'broadcast' as const } : levers

    const teardown = () => {
      for (const stop of cleanups.splice(0).reverse()) stop()
      engineRef.current = undefined
      guestRef.current = undefined
    }

    void (async () => {
      // **A fixture never asks the server for anything.** It is a room this tab
      // manufactured, with seats named `p0`/`p2` that no server issued — asking
      // would overwrite the stored signature with one for a seat the fixture
      // will never play under, and the next real room would present it and be
      // refused. It also stays off Ably entirely, whatever `?transport=` says:
      // publishing a synthetic room into a shared channel namespace would put
      // a fake game in front of anyone who has the code.
      const realtime = seat.declared
        ? { seat: selfId, stubbed: true }
        : await probeRealtime(roomCode, selfId)
      if (cancelled) return
      const stubbed = realtime.stubbed
      // The seat is signed; the room itself is the next question.
      store.setBoot({ stage: 'claiming' })

      // **Play under the seat the server signed, not the one we minted.** On a
      // first visit the local id has no signature, so the route issues a fresh
      // one — and a tab that kept using its own would declare a `clientId` the
      // token does not bind, which Ably refuses.
      const activeId = seat.declared ? selfId : realtime.seat
      const hostId = seat.declared ? seat.hostId : activeId

      // The question this whole phase turns on. A fixture declares; everyone
      // else asks and lives with the answer.
      const hostEndpoint = await connectRoom({
        roomCode,
        selfId: hostId,
        role: seat.declared ? 'host' : 'auto',
        levers: roomLevers,
        stubbed,
      })
      if (cancelled) {
        hostEndpoint.close()
        return
      }
      cleanups.push(() => hostEndpoint.close())

      // The claim is the authority on which screen this is. It overrides the
      // seed `intendedRole` opened on — including the case that seed cannot
      // predict: a guest who typed a code nobody was hosting and just won it.
      store.setBoot({
        stage: 'waiting',
        role: hostEndpoint.isHost ? 'host' : 'guest',
      })

      if (hostEndpoint.isHost) {
        await startAsHost(hostEndpoint, stubbed, activeId, hostId)
      } else {
        await startAsGuest(stubbed, activeId)
      }
    })().catch((error: unknown) => {
      if (cancelled) return
      // A room that cannot be built says why, on screen. That case is expected
      // and fully explained, so it is not logged as an error — doing so puts
      // Next's crash overlay over a message that is already the answer.
      if (error instanceof RoomUnavailable) {
        store.setError(error.message)
        return
      }
      // Anything else is a bug. It still gets a sentence, because a bug that
      // leaves the boot screen spinning forever is the worst shape it could
      // take, but the detail belongs in the log.
      store.setError('This room didn’t open. Reload, or start a new one.')
      console.error('[room] could not connect', error)
    })

    /* ---------------- this tab owns the room ---------------- */

    async function startAsHost(
      hostTransport: RoomTransport,
      stubbed: boolean,
      activeId: string,
      hostId: string,
    ) {
      // This *tab* runs the engine, but under `?as=` the *player* is a guest
      // sitting in someone else's fixture. `isHost` is about the seat, not the
      // engine, because it is what decides whether a screen offers the host's
      // controls — and offering them to p2 would hand them a refusal.
      store.setIdentity(activeId, hostId === activeId)

      const restored = loadSnapshot(roomCode)
      const pending = levers.phase === undefined ? readPendingSettings() : undefined
      if (pending) clearPendingSettings()
      const fresh =
        levers.phase !== undefined
          ? rebaseClock(
              fixtureFor(levers.phase, {
                // A fixture needs a populated room whether or not bots drive it —
                // `?phase=vote` alone is how a screen gets reviewed in isolation.
                players: levers.bots !== undefined ? levers.bots + 1 : 5,
                seed: levers.seed,
                settings: leverSettings(levers),
                out: levers.out,
              }),
              Date.now(),
            )
          : createRoom({
              roomCode,
              // The host names itself from the same identity a guest joins
              // with, so "You" is only ever a fallback for a tab that never
              // passed through `/host`.
              host: {
                id: activeId,
                name: seat.identity.name || HOST_FALLBACK_NAME,
                avatarSeed: seat.identity.avatarSeed,
                hat: seat.identity.hat,
              },
              // Whatever `/host` just chose, if this tab came through it.
              // Cleared on use so a later room does not silently inherit them.
              settings: pending ?? leverSettings(levers),
              seed: levers.seed ?? Math.floor(Math.random() * 2 ** 31),
              at: Date.now(),
            })
      // Prefer whichever is further along: a reload mid-game should not restart it.
      const initial = restored && restored.rev > fresh.rev ? restored : fresh

      const engine = new HostEngine({
        transport: hostTransport,
        initial,
        fast: levers.fast,
        onChange: (state) => {
          saveSnapshot(roomCode, state)
          // Bots watch the engine, not the wire. Every accepted transition
          // passes through here, which is the same set `announce` fires on.
          // Read off the ref rather than a local, because the pool needs
          // `engine.apply` and so cannot exist until the engine does.
          poolRef.current?.observe(state)
        },
        // Only *our* refusals are worth a snackbar. A bot being told to sit a
        // round out is the harness working, not something to interrupt over.
        // Everyone else's travel the transport instead — see `HostEngine.refuse`.
        onRefused: (intent, reason) => {
          if (intent.from !== activeId) return
          announce(reason)
        },
      })
      engineRef.current = engine
      cleanups.push(() => engine.stop())

      // The host is a player too, so it needs the same state feed a guest gets.
      // Under `?as=` the local endpoint is a genuine guest instead: its own
      // endpoint, its own seat, and intents over the same road a real guest's
      // travels.
      const selfTransport =
        hostId === activeId
          ? hostTransport
          : await connectRoom({
              roomCode,
              selfId: activeId,
              role: 'guest',
              levers: roomLevers,
              stubbed,
            })
      if (cancelled) return
      if (selfTransport !== hostTransport) cleanups.push(() => selfTransport.close())

      attachSelf(selfTransport)

      // **One pool, however bots arrive.** `?bots=N` seats them up front and
      // the lobby's control seats them later; both go through the same object,
      // so the dev lever exercises the shipped road rather than a parallel one.
      const pool = new BotPool({
        apply: (action, actor) => engine.apply(action, actor),
        snapshot: () => engine.snapshot(),
        now: () => engine.now(),
        rate: levers.fast,
      })
      poolRef.current = pool
      cleanups.push(() => {
        poolRef.current = undefined
        pool.close()
      })

      for (let i = 0; i < (levers.bots ?? 0); i += 1) {
        pool.add(DEFAULT_DIFFICULTY)
      }

      // Only autopilot a room that has bots in it: with real people, those taps
      // are the host's, and every untimed phase has a button for them.
      if (levers.bots) {
        const autopilot = createAutopilot({
          engine,
          waitFor: levers.bots + 1,
          // The dwell is in room time, so `?fast=80` shortens it too — otherwise
          // a sped-up game would still crawl through ten untimed phases.
          rate: levers.fast ?? 1,
        })
        cleanups.push(hostTransport.onState((state) => autopilot(state)))
      }

      engine.start()

      // A throttled background tab stops firing timers, and guests must never
      // self-advance — so the room would silently freeze at 0:00 without this.
      const onVisible = () => engine.catchUp()

      /**
       * Make the host mean it.
       *
       * The room ends with its host, and until now it ended on a stray ⌘W with
       * no way back. This is the browser's own confirmation — the wording is
       * not ours to write — and it asks only while there is a game to lose:
       * closing the lobby costs nothing, and closing the podium costs a
       * scoreboard everyone has already read.
       *
       * **It changes nothing.** The departure moved to `pagehide` below,
       * because a handler that ended the room *and* asked would send the room
       * to `podium` and then leave a live tab sitting in it when the host
       * clicked Cancel.
       */
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        const phase = engine.snapshot().phase
        if (phase === 'lobby' || phase === 'podium') return
        event.preventDefault()
      }

      /**
       * The actual departure. A guest closing a tab is a different event
       * entirely — see `startAsGuest`.
       *
       * `pagehide` rather than `beforeunload` because it fires only when the
       * page really is going, and `persisted` tells us when it is merely being
       * frozen into the back/forward cache — coming back from which should
       * find the room still there.
       */
      const onPageHide = (event: PageTransitionEvent) => {
        if (event.persisted) return
        engine.apply({ type: 'host/left' }, hostId)
      }

      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('beforeunload', onBeforeUnload)
      window.addEventListener('pagehide', onPageHide)
      cleanups.push(() => {
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('beforeunload', onBeforeUnload)
        window.removeEventListener('pagehide', onPageHide)
      })
    }

    /* ---------------- somebody else owns the room ---------------- */

    async function startAsGuest(stubbed: boolean, activeId: string) {
      store.setIdentity(activeId, false)

      const transport = await connectRoom({ roomCode, selfId: activeId, role: 'guest', levers, stubbed })
      if (cancelled) {
        transport.close()
        return
      }
      cleanups.push(() => transport.close())

      attachSelf(transport)

      // Ask for a seat on the first broadcast, and ask for the *right* thing.
      //
      // Not in the room → join. Already in it but marked `reconnecting` → this
      // is a return, and joining again would be refused as a duplicate name
      // while leaving the seat reconnecting forever. That second branch is the
      // bug a held seat created: `player/left` keeps you in `players`, so the
      // "am I listed" guard saw a returning player as already handled and said
      // nothing at all.
      //
      // One-shot per outcome: both are in flight until the next broadcast.
      let asked = false
      cleanups.push(
        transport.onState((state) => {
          if (asked) return
          const mine = state.players.find((p) => p.id === activeId)
          if (mine && mine.connection === 'online') return

          asked = true
          store.setBoot({ stage: 'seating' })
          if (mine) {
            transport.sendIntent({ type: 'player/reconnected' })
            return
          }
          transport.sendIntent({
            type: 'player/joined',
            player: {
              id: activeId,
              name: seat.identity.name || 'Guest',
              avatarSeed: seat.identity.avatarSeed,
              hat: seat.identity.hat,
            },
          })
        }),
      )

      // Leaving holds the seat rather than ending the room — that is the host's
      // to do, and a guest firing `host/left` would kill a game it does not own.
      //
      // `pagehide`, and the same `persisted` guard the host's exit takes. On
      // `beforeunload` this fired for a page merely being frozen into the
      // back/forward cache, which was survivable while `player/left` only held
      // a seat — but since [ADR 0029](../../docs/adr/0029-a-held-seat-does-not-hold-the-round.md)
      // it also drops you out of the round's gates, so tabbing away and back
      // could hand the room a departure you never made.
      const onPageHide = (event: PageTransitionEvent) => {
        if (event.persisted) return
        transport.sendIntent({ type: 'player/left' })
      }
      window.addEventListener('pagehide', onPageHide)
      cleanups.push(() => window.removeEventListener('pagehide', onPageHide))
    }

    /** The local player's own feed, host or guest. */
    function attachSelf(transport: RoomTransport) {
      const client = new GuestClient({
        transport,
        onState: (state) => store.setState(state),
        onStatus: (status) => store.setStatus(status),
      })
      client.start()
      guestRef.current = client
      selfTransportRef.current = transport
      cleanups.push(() => client.stop())
      cleanups.push(() => {
        if (selfTransportRef.current === transport) selfTransportRef.current = undefined
      })
      // The one road a refusal can take to another tab.
      cleanups.push(
        transport.onRefusal((reason) => {
          // A refusal arriving before we are seated has nowhere to land: the
          // interstitial is still up, and it returns before the snackbar
          // renders. So a room that would not have us — full, most likely —
          // said so into silence and left the boot spinning forever. It goes
          // on the screen that is actually showing instead.
          //
          // Only here, not in `announce`: the in-process callback is the
          // host's own mid-game refusals, and a host is never refused a seat
          // in a room they just built.
          if (!isSeated(store.getSnapshot())) store.setBoot({ failure: reason })
          announce(reason)
        }),
      )
      // Chat and reactions. Deliberately not through `GuestClient`, which is
      // about state ordering and clock skew — an event has neither a `rev` nor
      // a deadline, so routing it through there would only borrow machinery it
      // does not use.
      cleanups.push(transport.onEvent((event) => events.receive(event)))
    }

    return () => {
      cancelled = true
      teardown()
    }
  }, [roomCode, levers, store, events, seat, selfId])

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
      identity: seat.identity,
      roomCode,
      fast: levers.fast,
      pacedBoot: !seat.declared,
      onRefused: (listener) => {
        refusalListeners.current.add(listener)
        return () => refusalListeners.current.delete(listener)
      },
      events,
      /**
       * Say something, or react to something.
       *
       * Straight onto the transport rather than through `send`. An intent asks
       * the host to change the room and can be refused; an event carries no
       * authority and there is nothing to refuse it, so routing chat through
       * the authorisation path would invent a decision nobody makes.
       *
       * `from` is filled in by the transport, which is the whole point — see
       * `RoomEvent`. The value passed here is a placeholder the wire discards.
       */
      publish: (event) => {
        selfTransportRef.current?.publishEvent(event)
      },
    }),
    [store, events, seat.identity, seat.declared, levers.fast, roomCode],
  )

  return <RoomContext.Provider value={binding}>{children}</RoomContext.Provider>
}
