import { canStart } from '@/lib/game/selectors'
import type { GameState } from '@/lib/game/types'
import type { HostEngine } from './HostEngine'

/**
 * Drives the host's *untimed* transitions so a room can run unattended.
 *
 * `lobby`, `reveal` and `score` have no deadline by design — a person taps
 * "Start game" or "Next round". Phase 1 has no UI to tap, so this stands in.
 *
 * Deliberately not part of `HostEngine`: those taps are product behaviour that
 * phase 2's screens own, and an engine that advances itself would make the real
 * button a no-op. This is a harness, and phase 2 keeps it only behind `?bots=`.
 */
export interface AutopilotOptions {
  engine: HostEngine
  /** Wait for this many players before starting. Defaults to whatever `canStart` allows. */
  waitFor?: number
}

export function createAutopilot(options: AutopilotOptions): (state: GameState) => void {
  const { engine, waitFor } = options
  const hostId = engine.snapshot().hostId

  return (state: GameState) => {
    switch (state.phase) {
      case 'lobby': {
        if (waitFor !== undefined && state.players.length < waitFor) return
        if (!canStart(state).ok) return
        engine.apply({ type: 'game/started' }, hostId)
        return
      }
      // Untimed and terminal-ish: the host decides when to move on.
      case 'reveal':
      case 'score':
        engine.apply({ type: 'round/advanced' }, hostId)
        return
      default:
    }
  }
}
