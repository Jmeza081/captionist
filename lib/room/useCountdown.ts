'use client'

import { useEffect, useState } from 'react'
import type { Clock } from '@/lib/game/types'
import { useRoomNow } from './useRoom'

/**
 * The visible clock, derived rather than stored.
 *
 * `store.ts` forbids anything time-varying in the snapshot: `getSnapshot` has
 * to return a stable reference or React 19 re-enters its render loop. So the
 * countdown lives here, in local state driven by an interval, and touches the
 * store not at all.
 *
 * It takes the `Clock` as an argument instead of reading the room itself, which
 * keeps the arithmetic a pure function of `(clock, roomNow)` and lets the shell
 * own the single interval on the page.
 */
export interface Countdown {
  /** Whole seconds remaining, rounded up so `0:01` shows until it really ends. */
  seconds: number
  /** Remaining as a share of the whole, for `ProgressRail`. */
  fraction: number
  running: boolean
  paused: boolean
}

const IDLE: Countdown = { seconds: 0, fraction: 0, running: false, paused: false }

/**
 * Four times a second, not once.
 *
 * `?fast=80` makes a room-second land every 12ms, so a one-second tick would
 * show a clock that lurches. Cheap either way: the hook re-renders only when
 * the displayed second actually changes.
 */
const TICK_MS = 250

function read(clock: Clock | undefined, roomNow: () => number): Countdown {
  if (!clock || clock.status === 'idle') return IDLE

  const remainingMs =
    clock.status === 'paused'
      ? Math.max(0, clock.remainingMs)
      : Math.max(0, clock.endsAt - roomNow())

  return {
    seconds: Math.ceil(remainingMs / 1_000),
    fraction: clock.totalMs > 0 ? Math.min(1, remainingMs / clock.totalMs) : 0,
    running: clock.status === 'running',
    paused: clock.status === 'paused',
  }
}

export function useCountdown(clock: Clock | undefined): Countdown {
  const roomNow = useRoomNow()
  const [value, setValue] = useState<Countdown>(IDLE)

  useEffect(() => {
    const sync = () =>
      setValue((prev) => {
        const next = read(clock, roomNow)
        // Bail out unless something visible moved. The rail's CSS transition
        // covers the gap between whole seconds, so re-rendering four times a
        // second to nudge a fraction would buy nothing.
        return prev.seconds === next.seconds &&
          prev.running === next.running &&
          prev.paused === next.paused
          ? prev
          : next
      })

    // Resync immediately: the clock may have changed phase, been paused, or
    // simply arrived, and waiting a tick to notice reads as a stutter.
    sync()

    // A paused or idle clock does not move, so it gets no interval.
    if (!clock || clock.status !== 'running') return
    const id = setInterval(sync, TICK_MS)
    return () => clearInterval(id)
  }, [clock, roomNow])

  return value
}
