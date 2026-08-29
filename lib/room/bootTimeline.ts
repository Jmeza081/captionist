'use client'

import { useEffect, useRef, useState } from 'react'
import type { BootStepState } from '@/components/molecules/BootChecklist'
import type { BootProgress, BootStage } from './store'

/**
 * Paces the boot checklist so it can be read.
 *
 * The screen reports real milestones — see `BootProgress` — and on the tab
 * transport all of them resolve in a few hundred milliseconds, which draws
 * three rows flicking to done inside a frame or two. Ably takes one to two
 * seconds and reads fine. So the timeline **never runs ahead of reality**; it
 * only refuses to finish before it has been seen.
 *
 * Two floors, and nothing else:
 *
 *   - a row holds `active` for at least `STEP_MIN_MS` before it may be done,
 *   - the whole screen holds for at least `BOOT_MIN_MS` before it hands off.
 *
 * Both scale by `?fast=`, the lever that already scales the room's clock — so
 * the harness URLs the suite boots over and over pay almost nothing, and a real
 * room gets the pacing the design draws.
 */

/** Each row is worth looking at. */
export const STEP_MIN_MS = 220

/** And the sequence as a whole is worth watching. */
export const BOOT_MIN_MS = 900

/**
 * How far along a stage is, as a row index.
 *
 * `probing` and `claiming` are one row: the seat probe and the election are a
 * single question to a player — is this room there, and is it mine.
 */
const STAGE_ROW: Record<BootStage, number> = {
  probing: 0,
  claiming: 0,
  waiting: 1,
  seating: 2,
}

export interface BootTimeline {
  /** One state per row, already paced. */
  states: readonly BootStepState[]
  /** 0–1 for the rail under them. */
  fraction: number
  /** True once the room may be handed over to the real screen. */
  settled: boolean
}

export interface BootTimelineOptions {
  boot: BootProgress
  /** The room is genuinely ready — state has arrived, and the seat with it. */
  ready: boolean
  /** `?fast=`, so a sped-up room has a sped-up boot. */
  fast?: number
  /**
   * False for a `?phase=` fixture, which is the room rather than a boot of one.
   * Holding a progress screen over it would be exactly the invented stage this
   * screen exists not to have — so it hands over the moment it can.
   */
  paced?: boolean
}

/**
 * Three rows, both roles.
 *
 * Not a per-role table: the *labels* differ, and those belong to the screen
 * that says them. The shape of the boot does not — a host and a guest wait on
 * the same three questions, and only the answers differ.
 */
const ROW_COUNT = 3

export function useBootTimeline({
  boot,
  ready,
  fast,
  paced = true,
}: BootTimelineOptions): BootTimeline {
  const scale = fast && fast > 0 ? fast : 1
  const stepFloor = paced ? STEP_MIN_MS / scale : 0
  const bootFloor = paced ? BOOT_MIN_MS / scale : 0

  // The furthest row the floors currently allow. Starts at 0: the first row is
  // active from the first frame, because the probe is already in flight.
  const [shown, setShown] = useState(0)
  const [elapsed, setElapsed] = useState(false)

  const startedAt = useRef<number | undefined>(undefined)
  startedAt.current ??= Date.now()

  // Where reality has got to. A ready room is past the last row.
  const real = ready ? ROW_COUNT : STAGE_ROW[boot.stage]

  useEffect(() => {
    if (shown >= real) return
    const id = setTimeout(() => setShown((current) => Math.min(current + 1, ROW_COUNT)), stepFloor)
    return () => clearTimeout(id)
  }, [shown, real, stepFloor])

  useEffect(() => {
    const remaining = bootFloor - (Date.now() - (startedAt.current ?? Date.now()))
    if (remaining <= 0) {
      setElapsed(true)
      return
    }
    const id = setTimeout(() => setElapsed(true), remaining)
    return () => clearTimeout(id)
  }, [bootFloor])

  const failedAt = boot.failure ? Math.min(shown, ROW_COUNT - 1) : undefined

  const states = Array.from({ length: ROW_COUNT }, (_, index): BootStepState => {
    if (failedAt !== undefined) {
      if (index === failedAt) return 'failed'
      return index < failedAt ? 'done' : 'pending'
    }
    if (index < shown) return 'done'
    return index === shown ? 'active' : 'pending'
  })

  const done = states.filter((state) => state === 'done').length
  const active = states.filter((state) => state === 'active').length

  return {
    states,
    fraction: Math.min(1, (done + active * 0.5) / ROW_COUNT),
    // A failure never settles: the screen stays up to say what happened.
    // Unpaced, a ready room hands over on the same frame — walking a fixture
    // through three rows nobody asked for is the flicker the floors exist to
    // prevent, not a smaller version of it.
    settled: ready && !boot.failure && (!paced || (elapsed && shown >= ROW_COUNT)),
  }
}
