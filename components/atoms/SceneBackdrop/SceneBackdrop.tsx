'use client'

import { useEffect, useRef } from 'react'
import { TvStatic } from '@/components/atoms/TvStatic'
import { useReducedMotion } from '@/lib/useReducedMotion'
import styles from './SceneBackdrop.module.scss'

export interface SceneBackdropProps {
  /**
   * The clip. Muted, looped, and paused until motion is allowed.
   *
   * Optional, because the clip is resolved over the network now and there is a
   * beat before it exists — see `tuning`.
   */
  mp4?: string
  /** The frame behind it, and the whole of what a still visitor sees. */
  still?: string
  /**
   * No clip yet, and one still coming.
   *
   * Draws television static — a channel that has not tuned in. It is the
   * honest picture of the state: the backdrop is fetched from a provider in
   * the browser, and used to be simply absent for that beat, which read as a
   * screen that had forgotten its own design.
   *
   * `tuning` and no clip is static; settled and no clip is nothing at all. The
   * difference matters because a lookup that failed will not un-fail, and a
   * dead channel hissing behind the words forever is a distraction rather than
   * a flourish.
   */
  tuning?: boolean
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
export function SceneBackdrop({
  mp4,
  still,
  tuning = false,
  scrim = 'soft',
}: SceneBackdropProps) {
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

  // Settled on nothing: no clip, and none coming. The screen keeps its own
  // background, which is exactly what it had before any of this was fetched.
  if (!mp4 && !tuning) return null

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {mp4 ? (
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
      ) : (
        /**
         * A channel tuning in.
         *
         * Marked with its own testid rather than sharing the video's: they are
         * different states, and a spec that could not tell them apart would
         * pass on a backdrop that never arrived.
         */
        <div className={styles.tuningFrame} data-testid="scene-backdrop-tuning">
          <TvStatic />
        </div>
      )}
      {/*
        The veil — lighter over static, by this component's own rule.

        `full` is documented as the weight for *media we do not control*, and
        `soft` for dark media the text can win against on its own. Static is
        ours, is uniformly dark, and carries nothing to read: it is the second
        case exactly. Under `full` plus its blur the grain flattens to grey and
        the effect disappears, which is how that was discovered.
      */}
      <div
        className={`${styles.scrim} ${mp4 ? styles[scrim] : styles.tuning}`}
      />
    </div>
  )
}
