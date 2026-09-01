import type { CSSProperties } from 'react'
import styles from './TvStatic.module.scss'

export interface TvStaticProps {
  /**
   * Which set on the wall this is.
   *
   * Twenty identical fields flickering in lockstep read as one continuous sheet
   * of noise stretched behind the page — the tile edges vanish and the whole
   * effect with them. This offsets both the field and the flicker, so each one
   * is its own television.
   */
  seed?: number
  /**
   * Hold the picture still.
   *
   * For the wall's pause control, which stops twenty of these at once. Someone
   * who asked for reduced motion is handled by the stylesheet instead — that is
   * a preference, not a control, and it should not depend on a prop being
   * passed.
   */
  paused?: boolean
}

/**
 * A set tuned to a channel that is not there.
 *
 * The placeholder for media that is still being fetched — one behind the
 * waiting screen, twenty across the landing wall — so a surface that has not
 * loaded reads as a television between channels rather than as a screen that
 * forgot its own design.
 *
 * An atom rather than two copies, because getting it to *look* like static took
 * four specific things and none of them are obvious:
 *
 *   1. **Dots, not grain.** `feComponentTransfer` with a `discrete` table snaps
 *      the turbulence to hard levels. Raw, it is smooth mid-grey mush.
 *   2. **Opaque.** `feTurbulence` writes noise into the *alpha* channel too, so
 *      unflattened the field is seethrough and reads as dirt on the canvas.
 *   3. **Scanlines**, which are most of what says television rather than noise.
 *   4. **A new field every frame**, not a drifting one.
 *
 * Generated rather than shipped: the SVG is a few hundred bytes inline and
 * needs no request and no decode, which matters on a surface that is already
 * waiting for one — and doubly so twenty times over.
 *
 * A server component. There is nothing here to hydrate, so the wall arrives
 * complete in the first HTML with no script and no network at all.
 */
export function TvStatic({ seed = 0, paused = false }: TvStaticProps) {
  return (
    <div
      className={styles.set}
      data-testid="tv-static"
      data-paused={paused || undefined}
      // A custom property rather than a class per set: the value is an index,
      // and twenty classes for twenty indices would be twenty of the same rule.
      style={{ '--set': seed } as CSSProperties}
    >
      {/*
        The noise is a child, and larger than its frame, because the animation
        moves it with `transform` rather than `background-position`. Position is
        a paint every frame; a transform is a compositor move — which is the
        difference between one of these and twenty being affordable.
      */}
      <div className={styles.noise} />
    </div>
  )
}
