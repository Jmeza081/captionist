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

  useEffect(() => {
    if (!burst) return

    const count = MIN + Math.floor(Math.random() * (MAX - MIN + 1))
    const made: Floater[] = Array.from({ length: count }, () => {
      seq.current += 1
      return {
        id: `${burst.key}-${seq.current}`,
        glyph: burst.glyph,
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
      const ids = new Set(made.map((f) => f.id))
      setFloaters((prev) => prev.filter((f) => !ids.has(f.id)))
    }, longest + 100)

    return () => clearTimeout(timer)
  }, [burst])

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
