import { canStart } from '@/lib/game/selectors'
import type { GameState } from '@/lib/game/types'
import type { HostEngine } from './HostEngine'

/**
 * Drives the host's *untimed* transitions so a room can run unattended.
 *
 * `lobby`, `reveal` and `score` have no deadline by design — a person taps
 * "Start game" or "Next round".
 *
 * Deliberately not part of `HostEngine`: those taps are product behaviour the
 * screens own, and an engine that advanced itself would make the real button a
 * no-op. This is a harness, and it is only ever attached behind `?bots=`.
 */
export interface AutopilotOptions {
  engine: HostEngine
  /** Wait for this many players before starting. Defaults to whatever `canStart` allows. */
  waitFor?: number
  /**
   * How long to sit on `reveal` and `score` before advancing.
   *
   * Zero would make both unreadable: the screens are real now, and a bot room
   * that advanced on the first broadcast would show a winner for one frame.
   */
  dwellMs?: number
  /** The room's clock rate, from `?fast=`. The dwell scales with it. */
  rate?: number
}

/** Long enough to read a winner, short enough not to test anyone's patience. */
const DWELL_MS = 4_000

export function createAutopilot(options: AutopilotOptions): (state: GameState) => void {
  const { engine, waitFor, dwellMs = DWELL_MS, rate = 1 } = options
  const hostId = engine.snapshot().hostId

  // The autopilot sees every broadcast, and a dwelling phase publishes more
  // than once. Without this, one reveal would queue a timer per broadcast.
  const scheduled = new Set<string>()

  return (state: GameState) => {
    switch (state.phase) {
      case 'lobby': {
        if (waitFor !== undefined && state.players.length < waitFor) return
        if (!canStart(state).ok) return
        engine.apply({ type: 'game/started' }, hostId)
        return
      }
      // Untimed: the host decides when to move on, after a beat to read it.
      case 'reveal':
      case 'score': {
        const delay = Math.max(0, dwellMs / Math.max(rate, 1))
        // `dwellMs: 0` keeps the advance synchronous, which is what the spine
        // test wants: it drives a virtual clock, and a real `setTimeout` would
        // never fire inside it. The dwell is product behaviour, not protocol.
        if (delay === 0) {
          engine.apply({ type: 'round/advanced' }, hostId)
          return
        }

        const key = `${state.roundNumber}:${state.phase}`
        if (scheduled.has(key)) return
        scheduled.add(key)
        setTimeout(() => {
          // The room may have moved on already — the host skipped, or a real
          // button was tapped. `round/advanced` is phase-guarded, so a late
          // fire is refused rather than jumping a phase.
          if (engine.snapshot().phase !== state.phase) return
          engine.apply({ type: 'round/advanced' }, hostId)
        }, delay)
        return
      }
      default:
    }
  }
}
