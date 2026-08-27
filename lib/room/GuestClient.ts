import type { ActionInput } from '@/lib/game/actions'
import type { PublicState } from '@/lib/game/types'
import type { RoomTransport, StateMeta, TransportStatus, Unsubscribe } from './transport'

/**
 * A non-host endpoint: sends intents, receives state, never decides anything.
 *
 * Its whole job beyond forwarding is **ordering and skew**. `rev` is monotonic,
 * so anything at or below the last revision applied is dropped — that makes
 * out-of-order or duplicate delivery a non-event rather than a flicker.
 * `hostNow` gives the offset between this clock and the host's, measured once
 * per broadcast, so a countdown rendered here agrees with the room even when
 * the two machines disagree about what time it is.
 */
export interface GuestClientOptions {
  transport: RoomTransport
  now?: () => number
  onState?: (state: PublicState) => void
  onStatus?: (status: TransportStatus) => void
}

export class GuestClient {
  private readonly transport: RoomTransport
  private readonly now: () => number
  private readonly teardown: Unsubscribe[] = []

  private state: PublicState | undefined
  private lastRev = 0
  /**
   * The last broadcast, as a pair of clocks plus a speed.
   *
   * A single skew offset is not enough once `?fast` exists: the host's clock
   * runs `rate`× faster, so between broadcasts a local clock advancing at 1×
   * falls behind and the countdown appears to stall, then jump. Anchoring both
   * clocks and scaling the elapsed time keeps `roomNow()` honest in the gaps.
   */
  private hostAnchor = 0
  private localAnchor = 0
  private rate = 1

  private readonly onStateChange?: (state: PublicState) => void
  private readonly onStatusChange?: (status: TransportStatus) => void

  constructor(options: GuestClientOptions) {
    this.transport = options.transport
    this.now = options.now ?? Date.now
    this.onStateChange = options.onState
    this.onStatusChange = options.onStatus
  }

  start(): void {
    this.teardown.push(
      this.transport.onState((state, meta) => this.receive(state, meta)),
      this.transport.onStatus((status) => this.onStatusChange?.(status)),
    )
    this.transport.setPresence('online')
  }

  private receive(state: PublicState, meta: StateMeta): void {
    if (meta.rev <= this.lastRev) return
    this.lastRev = meta.rev
    this.hostAnchor = meta.hostNow
    this.localAnchor = this.now()
    this.rate = meta.rate ?? 1
    this.state = state
    this.onStateChange?.(state)
  }

  /** The room's clock as this endpoint best understands it. */
  roomNow(): number {
    if (this.lastRev === 0) return this.now()
    return this.hostAnchor + (this.now() - this.localAnchor) * this.rate
  }

  snapshot(): PublicState | undefined {
    return this.state
  }

  send(action: ActionInput): void {
    this.transport.sendIntent(action)
  }

  stop(): void {
    for (const off of this.teardown.splice(0)) off()
  }
}
