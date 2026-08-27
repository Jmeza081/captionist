import type { ActionInput, GameAction } from '@/lib/game/actions'
import { authorize } from '@/lib/game/authorize'
import { project } from '@/lib/game/project'
import { reduce } from '@/lib/game/reducer'
import type { GameState, PlayerId, RoomPhase } from '@/lib/game/types'
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
          this.onRefused?.(intent, 'The clock is the host’s to keep.')
          return
        }
        this.apply(intent.action, intent.from, intent)
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
      if (intent) this.onRefused?.(intent, verdict)
      return false
    }
    const next = reduce(this.state, full)
    // The reducer returns the identical reference for a no-op, which is what
    // makes a stale timer cost nothing: no broadcast, no render.
    if (next === this.state) return false
    this.state = next
    this.schedule()
    this.publish()
    this.onChange?.(next)
    return true
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
    this.state = next
    this.schedule()
    this.publish()
    this.onChange?.(next)
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
