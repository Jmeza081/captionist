'use client'

import { useEffect, useRef, useState } from 'react'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import styles from './ReactionFloaters.module.scss'

export interface Floater {
  id: string
  glyph: string
  /** Horizontal drift in px, applied at the end of the rise. */
  dx: number
  /** Seconds. The design's range is 1.9–3.2s. */
  duration: number
  /** Where along the width it starts, 0–1. */
  offset: number
  size: number
}

export interface ReactionFloatersProps {
  /** Bump this to fire a burst; the value itself is ignored. */
  burst: { glyph: string; key: number } | null
}

/** The design fires 4–7 floaters per reaction. */
const MIN = 4
const MAX = 7

/**
 * The emoji burst that rises when somebody reacts.
 *
 * Purely decorative: `aria-hidden` and `pointer-events: none`, so it never
 * intercepts a click meant for the card underneath or narrates itself to a
 * screen reader. Each floater is keyed so React keeps its DOM node across
 * re-renders and the animation isn't restarted mid-flight.
 *
 * The glyph goes through `ReactionGlyph` like every other surface that renders
 * one off the wire. It didn't, once, and a burst of Slackmojis printed
 * `/media/slackmoji-lgtm.svg` up the screen in 30px text.
 */
export function ReactionFloaters({ burst }: ReactionFloatersProps) {
  const [floaters, setFloaters] = useState<Floater[]>([])
  const seq = useRef(0)
  /**
   * Every removal still pending.
   *
   * Held in a ref rather than returned as the effect's cleanup, because the
   * effect fires once *per burst* and each batch outlives the run that made it.
   * Cancelling on re-run was the second half of the bug below: the timer that
   * would have swept batch N was cleared the moment batch N+1 arrived, so
   * nothing was ever swept and the room filled up with emoji.
   */
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => () => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current.clear()
  }, [])

  /*
    Depended on by value, not by object.

    The room shell builds this prop inline — `burst && { glyph, key }` — so the
    object is new on every one of its renders, and a render happens on every
    clock tick. Keyed on the object, this effect fired several times a second
    and each run added another four to seven floaters that nothing removed.
    `key` already rises once per reaction, including a repeat of the same
    emoji, which is exactly the identity this wants.
  */
  const key = burst?.key
  const glyph = burst?.glyph

  useEffect(() => {
    if (key === undefined || glyph === undefined) return

    const count = MIN + Math.floor(Math.random() * (MAX - MIN + 1))
    const made: Floater[] = Array.from({ length: count }, () => {
      seq.current += 1
      return {
        id: `${key}-${seq.current}`,
        glyph,
        dx: Math.round((Math.random() - 0.5) * 160),
        duration: 1.9 + Math.random() * 1.3,
        offset: Math.random(),
        size: 20 + Math.round(Math.random() * 16),
      }
    })

    setFloaters((prev) => [...prev, ...made])

    // Drop them once the longest has finished, so the list can't grow without
    // bound over a long round.
    const longest = Math.max(...made.map((f) => f.duration)) * 1000
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      const ids = new Set(made.map((f) => f.id))
      setFloaters((prev) => prev.filter((f) => !ids.has(f.id)))
    }, longest + 100)
    timers.current.add(timer)
  }, [key, glyph])

  return (
    <div className={styles.layer} aria-hidden="true">
      {floaters.map((f) => (
        <span
          key={f.id}
          className={styles.floater}
          style={{
            left: `${f.offset * 100}%`,
            fontSize: `${f.size}px`,
            animationDuration: `${f.duration}s`,
            ['--dx' as string]: `${f.dx}px`,
          }}
        >
          <ReactionGlyph glyph={f.glyph} size={f.size} />
        </span>
      ))}
    </div>
  )
}
