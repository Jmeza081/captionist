'use client'

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Clock, RoomPhase } from '@/lib/game/types'
import { audio, type EngineSnapshot } from './engine'
import { useSoundPrefs } from './preferences'
import { bedFor, bedOffset, stingFor, ticks } from './soundtrack'

export interface SoundtrackOptions {
  phase: RoomPhase | undefined
  clock: Clock | undefined
  /** The last stretch of a running compose clock — the shell owns the threshold. */
  urgent: boolean
  /** From the shell's `useCountdown`, so there is still only one interval on the page. */
  seconds: number
  running: boolean
  roomNow: () => number
}

/**
 * The room's sound, driven by the room's phase.
 *
 * An effect in `RoomShell` and not the reducer, which is pure and has no
 * business knowing a speaker exists. Every tab runs its own copy against the
 * same broadcast phase, which is what keeps a remote room in step: nobody sends
 * audio anywhere, everybody plays the same file from the same moment.
 */
export function useSoundtrack({
  phase,
  clock,
  urgent,
  seconds,
  running,
  roomNow,
}: SoundtrackOptions): void {
  const prefs = useSoundPrefs()

  useEffect(() => {
    audio.setEnabled(prefs.music, prefs.sfx)
  }, [prefs.music, prefs.sfx])

  // Read when a bed starts rather than when it is asked for: the host nudging
  // the clock must not restart the music, and a bed that took a second to load
  // should still land where everybody else's is.
  const clockRef = useRef(clock)
  useEffect(() => {
    clockRef.current = clock
  })

  const bed = useMemo(() => (phase ? bedFor({ phase, urgent }) : null), [phase, urgent])
  useEffect(() => {
    audio.setBed(bed, () => bedOffset(clockRef.current, roomNow()))
  }, [bed, prefs.music, roomNow])

  useEffect(() => () => audio.stop(), [])

  const previous = useRef<RoomPhase | undefined>(undefined)
  useEffect(() => {
    if (!phase) return
    const sting = stingFor(previous.current, phase)
    previous.current = phase
    if (sting) audio.play(sting)
  }, [phase])

  useEffect(() => {
    if (phase && ticks(phase, running, seconds)) audio.play('tick')
  }, [phase, running, seconds])
}

const SERVER: EngineSnapshot = { state: 'off' }

/** Whether the page can make a sound right now, and what it is playing. */
export function useAudioEngine(): EngineSnapshot {
  return useSyncExternalStore(audio.subscribe, audio.getSnapshot, () => SERVER)
}
