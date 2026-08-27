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
  /** hostNow − localNow at the last broadcast. Added to local time for deadlines. */
  private skewMs = 0

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
    this.skewMs = meta.hostNow - this.now()
    this.state = state
    this.onStateChange?.(state)
  }

  /** The room's clock as this endpoint best understands it. */
  roomNow(): number {
    return this.now() + this.skewMs
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
