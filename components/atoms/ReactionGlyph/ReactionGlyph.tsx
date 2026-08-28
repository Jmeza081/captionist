'use client'

import { useEffect, useRef, useState } from 'react'
import { animatedSrcFor } from '@/lib/noto'
import { isImageGlyph } from '@/lib/reactions'
import { useReducedMotion } from '@/lib/useReducedMotion'
import styles from './ReactionGlyph.module.scss'

export interface ReactionGlyphProps {
  /** An emoji character, or the URL of an image tile. */
  glyph: string
  /** Matches the type size it sits beside. */
  size?: number
}

/** Start fetching the animation slightly before it scrolls into view. */
const ROOT_MARGIN = '64px'

/**
 * One reaction's face — a character or a picture, from a single glyph string.
 *
 * An atom rather than a ternary, because the wire carries the *glyph* and four
 * places render it: the vote grid's tallies, the reveal's, chat's, and the
 * burst layer. Once `REACTIONS` gained image tiles, every one of them would
 * otherwise have grown the same branch — and the day one of them forgot, a
 * tally would print a URL as text. Which is exactly what all of them did before
 * this existed.
 *
 * **The still comes first, always.** The glyph on the wire is a committed
 * same-origin SVG, so a reaction renders with no network and no third party.
 * For the imported catalog there is also an animation on Google's CDN, and this
 * fetches it only when all three of these hold: the tile is near the viewport,
 * the browser has not asked for less motion, and the file actually loads. It is
 * swapped in after it has decoded rather than assigned straight to `src`, so a
 * slow network shows a still emoji rather than a blank square.
 *
 * Decorative on purpose: `TallyPill` already hides its glyph from screen
 * readers and carries the reaction's name in its own visually-hidden label.
 */
export function ReactionGlyph({ glyph, size = 14 }: ReactionGlyphProps) {
  const animated = animatedSrcFor(glyph)
  const stillPreferred = useReducedMotion()
  const ref = useRef<HTMLImageElement>(null)
  /**
   * Which glyph we've loaded an animation for, rather than a bare boolean.
   *
   * Stamped with the glyph so a change of reaction falls back to its still by
   * derivation. A boolean would need resetting at the top of the effect below,
   * which is the cascading-render pattern React 19 warns about.
   */
  const [animating, setAnimating] = useState<string | null>(null)
  const moving = animating === glyph

  useEffect(() => {
    if (!animated || stillPreferred) return

    const el = ref.current
    if (!el) return

    let cancelled = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()

        // Decode first, swap second. Pointing `src` at the animation directly
        // would blank the tile for as long as ~369KB takes to arrive, which on
        // a bad connection is worse than never animating at all. A failure —
        // offline, blocked, CDN down — simply never resolves, and the still
        // stays, which is the whole reason it is committed.
        const preload = new Image()
        preload.onload = () => {
          if (!cancelled) setAnimating(glyph)
        }
        preload.src = animated
      },
      { rootMargin: ROOT_MARGIN },
    )
    observer.observe(el)

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [glyph, animated, stillPreferred])

  if (!isImageGlyph(glyph)) return <>{glyph}</>

  // Authored SVG and animated WebP alike — next/image would rasterise one and
  // re-encode the other, for art already sized to the tile.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={moving && animated ? animated : glyph}
      alt=""
      width={size}
      height={size}
      className={styles.image}
      loading="lazy"
      decoding="async"
    />
  )
}
