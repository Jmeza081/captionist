import type { Clock, RoomPhase } from '@/lib/game/types'
import type { CueId } from './catalog'

/**
 * What the room should sound like, as a pure function of where it is.
 *
 * No I/O and no clock reads, so it can be tested without an `AudioContext` —
 * the same split the round engine makes between the reducer and the host.
 * `useSoundtrack` turns these answers into calls on the engine.
 */

/** The music under a phase. `null` is silence, and silence is a choice. */
export interface Bed {
  cue: CueId
  /** 0–1, on top of the cue's own gain. The same cue at a new level ramps rather than restarts. */
  level: number
  /** Plays once, then the bed takes over on the next sample. */
  intro?: CueId
}

export interface SoundtrackInput {
  phase: RoomPhase
  /** The last stretch of a running compose clock. Computed by the caller, which owns the threshold. */
  urgent: boolean
}

/**
 * One bed per phase.
 *
 * - **The lobby and the opener share a bed**, so the round card lands over the
 *   music that was already playing rather than cutting it.
 * - **Writing gets its own bed, and the last stretch gets another.** "Boss
 *   Fight" is the urgency, not a layer over the bed — the set has no stems.
 * - **Waiting is silent.** Everybody who is done is in chat, and the ones who
 *   are not are the reason the room is waiting.
 * - **The vote and the reveal share a bed**, so the reveal's sting lands over
 *   music that is already there.
 * - **The podium plays the fanfare once, then a quiet loop** for however long
 *   the room stays to read it.
 */
export function bedFor({ phase, urgent }: SoundtrackInput): Bed | null {
  switch (phase) {
    case 'lobby':
    case 'opener':
      return { cue: 'title', level: 1 }
    case 'brief':
      return { cue: 'title', level: 0.6 }
    case 'compose':
      return urgent ? { cue: 'bossFight', level: 1 } : { cue: 'stageSelect', level: 1 }
    case 'waiting':
      return null
    case 'vote':
    case 'reveal':
      return { cue: 'stageSelect', level: 0.6 }
    case 'tiebreak':
      return { cue: 'bossFight', level: 0.7 }
    case 'score':
      return { cue: 'title', level: 0.6 }
    case 'podium':
      return { cue: 'ending', level: 1, intro: 'fanfare' }
  }
}

/** Whether two beds are the same music, so the second is a level change and not a restart. */
export function sameMusic(a: Bed | null, b: Bed | null): boolean {
  return a?.cue === b?.cue && a?.intro === b?.intro
}

/**
 * A one-shot on the way *into* a phase.
 *
 * Only on a transition — never on the first phase a tab sees — so reloading
 * into a reveal does not play the reveal at you a second time.
 */
export function stingFor(from: RoomPhase | undefined, to: RoomPhase): CueId | undefined {
  if (from === undefined || from === to) return undefined
  if (to === 'opener') return 'opener'
  if (to === 'reveal') return 'reveal'
  return undefined
}

/** The last five seconds of writing tick. Nothing else does. */
export const TICK_FROM = 5

export function ticks(phase: RoomPhase, running: boolean, seconds: number): boolean {
  return phase === 'compose' && running && seconds > 0 && seconds <= TICK_FROM
}

/**
 * Where a clock-driven bed should be, so every device plays the same bar.
 *
 * The anchor is the moment the phase began, in room time — `endsAt - totalMs`
 * — which every tab already agrees on to within its measured skew. A clockless
 * phase (the lobby, the podium) has no anchor and starts from the top, which
 * is also where every tab that saw the transition starts it.
 *
 * Returns seconds into the track, not wrapped: the engine knows the length.
 */
export function bedOffset(clock: Clock | undefined, roomNow: number): number {
  if (!clock || clock.status !== 'running') return 0
  const startedAt = clock.endsAt - clock.totalMs
  return Math.max(0, (roomNow - startedAt) / 1_000)
}
