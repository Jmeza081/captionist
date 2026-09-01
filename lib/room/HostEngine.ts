import type { ActionInput, GameAction } from '@/lib/game/actions'
import { authorize } from '@/lib/game/authorize'
import { project } from '@/lib/game/project'
import { reduce } from '@/lib/game/reducer'
import type { GameState, PlayerId, RoomPhase } from '@/lib/game/types'
import { roomAnnouncements } from './announce'
import type { Intent, RoomTransport, Unsubscribe } from './transport'

/**
 * The host browser is the server.
 *
 * One loop, in this order: **authorize → reduce → schedule → publish.** Nothing
 * else may produce a `GameState`. Guests send intents; this decides.
 *
 * Two things it owns that the pure reducer deliberately cannot:
 *
 * - **`at`.** Every action is stamped here, at the moment of application, so
 *   the reducer can set deadlines without calling `Date.now()`.
 * - **The timer.** Exactly one `setTimeout` is outstanding at a time, aimed at
 *   the current phase's `endsAt` and carrying the phase it was scheduled for.
 *   A late, duplicate or stale fire is then a reducer no-op, which is what
 *   removes the need for any cancellation bookkeeping.
 */

export type TimerHandle = ReturnType<typeof setTimeout>

export interface HostEngineOptions {
  transport: RoomTransport
  initial: GameState
  /**
   * Wall-clock source. Injectable so tests drive time by hand.
   *
   * `fast` scales this rather than shrinking `PHASE_DURATIONS`, which keeps the
   * reducer untouched and — because guests derive their countdown from the same
   * scaled `hostNow` — keeps every clock in the room agreeing. A 5-round game
   * runs in ~30s at `fast=10` instead of ~5 minutes.
   */
  now?: () => number
  fast?: number
  setTimer?: (fn: () => void, ms: number) => TimerHandle
  clearTimer?: (handle: TimerHandle) => void
  /** Called after every accepted action, for the dev route and tests. */
  onChange?: (state: GameState) => void
  /** Called when an intent is refused, with the reason `authorize` gave. */
  onRefused?: (intent: Intent, reason: string) => void
}

export class HostEngine {
  private state: GameState
  private readonly transport: RoomTransport
  private readonly realNow: () => number
  private readonly fast: number
  private readonly origin: number
  private readonly setTimer: (fn: () => void, ms: number) => TimerHandle
  private readonly clearTimer: (handle: TimerHandle) => void
  private readonly onChange?: (state: GameState) => void
  private readonly onRefused?: (intent: Intent, reason: string) => void

  private timer: TimerHandle | undefined
  private timerFor: RoomPhase | undefined
  /** Seats presence has actually seen. See `reconcile`. */
  private readonly everAttached = new Set<PlayerId>()
  private readonly teardown: Unsubscribe[] = []
  private stopped = false

  constructor(options: HostEngineOptions) {
    this.transport = options.transport
    this.state = options.initial
    this.realNow = options.now ?? Date.now
    this.fast = options.fast && options.fast > 0 ? options.fast : 1
    this.origin = this.realNow()
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = options.clearTimer ?? ((h) => clearTimeout(h))
    this.onChange = options.onChange
    this.onRefused = options.onRefused
  }

  /**
   * The room's clock. Real time when `fast` is 1, scaled otherwise.
   *
   * Everything — deadlines, `at` stamps, the `hostNow` guests sync to — reads
   * from here, so speeding the room up cannot desynchronise it from itself.
   */
  now(): number {
    if (this.fast === 1) return this.realNow()
    return this.origin + (this.realNow() - this.origin) * this.fast
  }

  start(): void {
    this.teardown.push(
      this.transport.onIntent((intent) => {
        // Any inbound traffic is a chance to notice a deadline the timer
        // slept through — a throttled background tab is the common case.
        this.catchUp()
        if (intent.action.type === 'clock/expired') {
          // The trust boundary. `clock/expired` is the engine's own event, so
          // accepting one off the wire would let any guest end a phase early.
          this.refuse(intent, 'The clock is the host’s to keep.')
          return
        }
        this.apply(intent.action, intent.from, intent)
      }),
    )
    // Presence does two jobs, and the second one is why the reconnect layer
    // was inert until now.
    //
    // A member *appearing* is the only thing that makes a late joiner
    // possible: `recipients()` already unions `members()`, but nothing
    // published when that set grew, so a guest attaching after `start()`
    // waited on a broadcast that never came.
    //
    // A member *vanishing* is a player dropping — and until this, the host
    // detected it and did nothing. `player/left` holds their seat and their
    // submission for `SEAT_GRACE_MS`; coming back reclaims it. That is the
    // whole of `ConnectionState`, which had four writers and no readers.
    this.teardown.push(
      this.transport.onPresence((entries) => {
        if (this.stopped) return
        this.reconcile(entries.map((entry) => entry.id))
        this.publish()
      }),
    )

    this.transport.setPresence('online')
    this.schedule()
    this.publish()
  }

  /** Current state. The dev route reads this; screens read the store. */
  snapshot(): GameState {
    return this.state
  }

  /**
   * Apply an action on behalf of `actor`.
   *
   * `actor` comes from the transport's authenticated sender, never the payload,
   * so a guest cannot act as someone else.
   */
  apply(action: ActionInput, actor: PlayerId, intent?: Intent): boolean {
    if (this.stopped) return false
    const full = { ...action, at: this.now(), actor } as GameAction
    const verdict = authorize(this.state, full)
    if (verdict !== true) {
      if (intent) this.refuse(intent, verdict)
      return false
    }
    const next = reduce(this.state, full)
    // The reducer returns the identical reference for a no-op, which is what
    // makes a stale timer cost nothing: no broadcast, no render.
    if (next === this.state) return false
    this.commit(this.state, next)
    return true
  }

  /**
   * Everything that follows accepting a new state, in one place.
   *
   * `apply` and `expire` reached this point with the same four lines copied.
   * The announcement is why they stop: it is derived from the *transition*, so
   * it has to sit where every accepted transition passes — an intent, the
   * host's own action, or a clock expiring — and a fifth line copied twice is a
   * fifth line that will one day be added once.
   *
   * **Ordering is load-bearing.** `publish()` comes first so every tab holds
   * the state a line describes before the line arrives: the log resolves
   * "Vic is back" off `state.players`, and a name landing ahead of the roster
   * renders "Someone" for somebody sitting right there.
   */
  private commit(before: GameState, next: GameState): void {
    this.state = next
    this.schedule()
    this.publish()
    this.announce(before, next)
    this.onChange?.(next)
  }

  /**
   * What the room says about itself — once per accepted change, to everybody.
   *
   * Here rather than at the two screens that switch modes, for three reasons.
   * A screen fires even when the host *refuses* the action. No screen fires at
   * all for a drop, because nobody taps for one. And under `?as=` the tab that
   * taps is not the host, so the event would be stamped with a guest's id and
   * correctly refused on arrival.
   */
  private announce(before: GameState, after: GameState): void {
    for (const body of roomAnnouncements(before, after)) {
      this.transport.publishEvent({
        kind: 'announcement',
        from: this.transport.selfId,
        body,
        at: this.now(),
      })
    }
  }

  /**
   * Turn "who is attached" into "who is playing".
   *
   * The transport knows sockets; the reducer knows seats. Nothing joined the
   * two, so a dropped player stayed `online` in the roster forever and the
   * held-seat machinery never ran.
   *
   * Deliberately one-way per player and idempotent: a presence set arrives on
   * every change, so this is called constantly and must cost nothing when
   * nothing moved. The reducer returning the same reference for a no-op is
   * what makes that true.
   */
  private reconcile(attached: readonly PlayerId[]): void {
    const here = new Set(attached)
    for (const id of here) this.everAttached.add(id)

    for (const player of this.state.players) {
      // The host is not a member of its own transport in every
      // implementation, and a host that dropped is not a case presence can
      // report — the room would be gone with it.
      if (player.id === this.state.hostId) continue

      // **Only a seat that was ever attached can be reported as dropping.**
      // Absence proves nothing on its own: a fixture room's players are in
      // `state.players` and were never connections at all, and a real guest is
      // in the roster for a moment before their presence entry is read. Both
      // used to be marked `reconnecting` — harmless while nothing read the
      // flag, and a room full of phantoms the moment the phase gates did.
      const present = here.has(player.id)
      if (!present && player.connection === 'online') {
        if (!this.everAttached.has(player.id)) continue
        this.apply({ type: 'player/left' }, player.id)
      } else if (present && player.connection !== 'online') {
        this.apply({ type: 'player/reconnected' }, player.id)
      }
    }
  }

  /**
   * Tell the asker why, wherever they are.
   *
   * The in-process callback is kept because the host's own refusals never
   * touch the wire — it is the same tab — and because the dev route and the
   * tests read it. Everyone else gets the sentence over the transport, which
   * is the only route that reaches another tab.
   */
  private refuse(intent: Intent, reason: string): void {
    this.onRefused?.(intent, reason)
    if (intent.from !== this.transport.selfId) {
      this.transport.publishRefusal(intent.from, reason)
    }
  }

  /**
   * Fire a deadline that has already passed.
   *
   * Guests must never self-advance, so a host whose `setTimeout` was throttled
   * is the room silently stopping. Called on every inbound intent and, in the
   * browser, on `visibilitychange`.
   */
  catchUp(): void {
    if (this.stopped) return
    const clock = this.state.clock
    if (clock.status !== 'running') return
    if (this.now() < clock.endsAt) return
    this.expire(this.state.phase)
  }

  /**
   * Fire the timer for `phase`, bypassing `authorize`.
   *
   * Deliberately not routed through `apply`: `authorize` answers "may this
   * *player* do this", and the timer is not a player — it has no seat in the
   * room, so the actor check would reject it (correctly). The reducer's own
   * phase guard is what makes a stale or duplicate fire a no-op.
   */
  private expire(phase: RoomPhase): void {
    if (this.stopped) return
    const action: GameAction = {
      type: 'clock/expired',
      phase,
      at: this.now(),
      actor: this.state.hostId,
    }
    const next = reduce(this.state, action)
    if (next === this.state) return
    this.commit(this.state, next)
  }

  private schedule(): void {
    if (this.timer !== undefined) {
      this.clearTimer(this.timer)
      this.timer = undefined
      this.timerFor = undefined
    }
    const clock = this.state.clock
    if (clock.status !== 'running') return

    const phase = this.state.phase
    // Scale back to real milliseconds: the deadline lives on the room's clock.
    const waitMs = Math.max(0, (clock.endsAt - this.now()) / this.fast)
    this.timerFor = phase
    this.timer = this.setTimer(() => {
      this.timer = undefined
      this.timerFor = undefined
      this.expire(phase)
    }, waitMs)
  }

  private publish(): void {
    const meta = { rev: this.state.rev, hostNow: this.now(), rate: this.fast }
    // One projection per recipient: a voter keeps authorship of their own
    // entry, everyone else's is stripped. See `project.ts`.
    for (const id of this.recipients()) {
      this.transport.publishState(project(this.state, id), meta, id)
    }
  }

  private recipients(): readonly PlayerId[] {
    const ids = new Set<PlayerId>([this.transport.selfId])
    for (const player of this.state.players) ids.add(player.id)
    // Attached-but-not-yet-joined endpoints included: a guest cannot ask to
    // join a room whose state it has never been sent.
    for (const id of this.transport.members?.() ?? []) ids.add(id)
    return [...ids]
  }

  /** Which phase the outstanding timer was aimed at. Test affordance. */
  pendingTimerPhase(): RoomPhase | undefined {
    return this.timerFor
  }

  stop(): void {
    this.stopped = true
    if (this.timer !== undefined) this.clearTimer(this.timer)
    this.timer = undefined
    this.timerFor = undefined
    for (const off of this.teardown.splice(0)) off()
  }
}
