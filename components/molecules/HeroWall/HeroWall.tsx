'use client'

import { useEffect, useRef, useState } from 'react'
import { WALL_SLUGS } from '@/lib/gifs/art'
import { intendedProvider } from '@/lib/gifs/registry'
import { useResolvedArt } from '@/lib/gifs/useArt'
import { cycleTiles, toWallTile, type WallTile } from '@/lib/gifs/wall'
import { useReducedMotion } from '@/lib/useReducedMotion'
import styles from './HeroWall.module.scss'

/**
 * The tilted wall of looping GIFs behind the landing hero.
 *
 * It is the product demo — the design's own note on artboard 1a says so —
 * which is why it is real media rather than a gradient. Four things keep
 * twenty simultaneous animations from being a disaster:
 *
 * 1. **Video, not GIF.** An MP4 of the same clip is roughly a tenth of the
 *    bytes and decodes on the video path rather than the main thread. Giphy
 *    serves both renditions; `lib/gifs` prefers the MP4.
 * 2. **A still on every tile.** The wall is complete and correctly sized in
 *    the first HTML, so nothing shifts when the motion arrives — and motion is
 *    a progressive enhancement rather than something the page waits on.
 * 3. **It is not the LCP element.** A background this size is excluded from
 *    LCP candidacy; the headline in front of it is the real candidate, and it
 *    is text.
 * 4. **Motion is optional and reversible.** Playback starts off and is only
 *    turned on after the reduced-motion query has been read, so a visitor who
 *    asked for stillness never sees a frame. Everyone else gets a control.
 *
 * `'use client'` buys the media query and that control. The markup still
 * server-renders — that is what a client component does in the App Router — so
 * none of the above waits on hydration.
 */
/**
 * How hard the wall is veiled.
 *
 * `full` is the landing hero's, and it is not decoration: it is what holds
 * 98px type legible over media we do not control. `soft` is for a wall
 * nothing sits on top of — there the veil only has to keep the tiles reading
 * as background, and the hero's weight just looks like the page failed to
 * load.
 */
export type HeroWallScrim = 'full' | 'soft'

export interface HeroWallProps {
  tiles: readonly WallTile[]
  /** Describes the wall for anyone who can't see it. */
  label?: string
  scrim?: HeroWallScrim
}

export function HeroWall({
  tiles: fallback,
  label = 'a wall of looping reaction GIFs',
  scrim = 'full',
}: HeroWallProps) {
  /**
   * The app's own art first, the provider's when it lands.
   *
   * A server may not fetch this — the request has to come from a browser and
   * the URL must not be retained — so the wall arrives complete and correctly
   * sized in the first HTML, and improves. See `art.ts`.
   */
  const { art } = useResolvedArt(WALL_SLUGS)
  const tiles = art ? cycleTiles(art.map(toWallTile), fallback.length) : fallback
  const videos = useRef<HTMLVideoElement[]>([])
  // `useReducedMotion` reports stillness until it knows otherwise, so this
  // starts paused and nothing plays before we know whether it should.
  const stillPreferred = useReducedMotion()
  const [paused, setPaused] = useState(false)
  const playing = !stillPreferred && !paused
  // No point offering a pause control to someone who has already asked for
  // stillness at the system level.
  const offered = !stillPreferred

  useEffect(() => {
    for (const video of videos.current) {
      if (!video) continue
      if (playing) void video.play().catch(() => undefined)
      else video.pause()
    }
  }, [playing, tiles])

  return (
    <>
      <div className={styles.wall} aria-hidden="true">
        <div className={styles.grid} data-testid="hero-wall">
          {tiles.map((tile, i) => (
            <div key={tile.id} className={styles.tile}>
              {tile.mp4 ? (
                <video
                  ref={(el) => {
                    if (el) videos.current[i] = el
                  }}
                  className={styles.media}
                  poster={tile.poster}
                  muted
                  loop
                  playsInline
                  preload="none"
                  tabIndex={-1}
                >
                  <source src={tile.mp4} type="video/mp4" />
                </video>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- remote,
                   animated, and decorative; next/image would rasterise it.

                   Swapping the file is the only way to stop an animated image:
                   CSS cannot reach inside one, and an SVG used as an image does
                   not reliably inherit the page's motion preference. */
                <img
                  className={styles.media}
                  src={playing ? (tile.motion ?? tile.poster) : tile.poster}
                  alt=""
                  loading="lazy"
                />
              )}
            </div>
          ))}
        </div>

        {/* Over the wall, under the content. At `full` this is what holds 98px
            type legible against media we do not control. */}
        <div className={`${styles.scrim} ${styles[scrim]}`} />
      </div>

      {/* Outside the wall on purpose: the wall is inert and makes its own
          stacking context, so a control inside it can neither be clicked
          through the content layer nor raised above it. */}
      {offered && (
        <button type="button" className={styles.toggle} onClick={() => setPaused((off) => !off)}>
          {playing ? 'Pause' : 'Play'} background
          <span className={styles.srOnly}>. Shows {label}.</span>
        </button>
      )}

      {/*
        Somebody else's art, credited.

        Read here rather than passed in, for the same reason `GifPanel` carries
        its own mark: the wall renders on four routes, and a prop threaded
        through four pages is a prop three of them can forget. It appears only
        once real art has resolved — the offline shelf is ours and is nobody
        else's to be credited for, and until then that is what is on screen.
      */}
      {art && (
        <span className={styles.credit}>
          GIFs via {intendedProvider().descriptor.name}
        </span>
      )}
    </>
  )
}
