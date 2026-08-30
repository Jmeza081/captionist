'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import styles from './SceneBackdrop.module.scss'

export interface SceneBackdropProps {
  /** The clip. Muted, looped, and paused until motion is allowed. */
  mp4: string
  /** The frame behind it, and the whole of what a still visitor sees. */
  still: string
  /**
   * How hard the veil is. `soft` for dark media the text can win against on
   * its own; `full` is the landing hero's weight, for media we do not control.
   */
  scrim?: 'soft' | 'full'
}

/**
 * Media behind a whole screen, rather than inside a card.
 *
 * A component and not four lines in the screen that wants one, because what it
 * carries is [ADR 0005](../../../docs/adr/0005-media-that-can-move-ships-a-still.md)'s
 * contract, and that contract is the part which is easy to re-implement wrong:
 * **playback starts off**, a client island reads the motion query and turns it
 * on, so somebody who asked for stillness never sees a frame rather than seeing
 * one and then having it stop. `autoplay` plus a `pause()` is the version that
 * looks right and is not. `HeroWall` holds the same contract for a grid of
 * tiles; this holds it for one full-bleed clip, and neither can serve the
 * other's shape.
 *
 * `position: fixed`, so it stays put while the column scrolls over it — a
 * backdrop that scrolled away would be a band of media, not a background. It
 * is inert and `aria-hidden`: there is nothing here to read, and the screen in
 * front of it says everything.
 *
 * No pause control, unlike `HeroWall`. The wall is the landing page's product
 * demo and worth a control of its own; this is a dark loop behind a sentence,
 * and a button floating over a waiting screen would be the loudest thing on it.
 * The motion query still turns it off, which is the preference that matters.
 */
export function SceneBackdrop({ mp4, still, scrim = 'soft' }: SceneBackdropProps) {
  const video = useRef<HTMLVideoElement | null>(null)
  // Reports stillness until it knows otherwise, so nothing plays before we
  // know whether it should.
  const stillPreferred = useReducedMotion()

  useEffect(() => {
    const el = video.current
    if (!el) return
    if (stillPreferred) el.pause()
    else void el.play().catch(() => undefined)
  }, [stillPreferred])

  return (
    <div className={styles.backdrop} aria-hidden="true">
      <video
        ref={video}
        className={styles.media}
        poster={still}
        muted
        loop
        playsInline
        preload="none"
        tabIndex={-1}
        data-testid="scene-backdrop"
      >
        <source src={mp4} type="video/mp4" />
      </video>
      <div className={`${styles.scrim} ${styles[scrim]}`} />
    </div>
  )
}
