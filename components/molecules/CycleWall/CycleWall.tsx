'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { TvStatic } from '@/components/atoms/TvStatic'
import { WALL_SLUGS } from '@/lib/gifs/art'
import { intendedProvider } from '@/lib/gifs/registry'
import { useResolvedArt } from '@/lib/gifs/useArt'
import { cycleTiles, toWallTile, type WallTile } from '@/lib/gifs/wall'
import { useReducedMotion } from '@/lib/useReducedMotion'
import styles from './CycleWall.module.scss'

export interface CycleWallProps {
  /**
   * How many frames stand in the row at the widest.
   *
   * A narrower column shows fewer — the row never scrolls and never wraps, so
   * frames drop off the end and what is left is centred. All of them render;
   * the container queries in the stylesheet decide which get a box.
   */
  frames?: number
  /** How many GIFs each frame walks through before repeating. */
  perFrame?: number
  /** Describes the wall for anyone who cannot see it. */
  label?: string
}

/**
 * A row of frames, each dissolving through a handful of GIFs.
 *
 * The design's note on artboard 1h is the brief: *"turns unavoidable dead time
 * into anticipation with a live cycling GIF wall … rather than an empty
 * spinner."* It is decoration with a job — the round's Captionist is off
 * scrolling a provider, and this is the room watching the same river go past.
 *
 * **Not `HeroWall`, and the difference is the cycle.** That is twenty static
 * tiles tiled across a whole page with a pause control of its own; this is four
 * frames, each holding a stack that cross-fades. The pieces they genuinely
 * share are shared: `WALL_SLUGS`, `toWallTile`, `cycleTiles`, `TvStatic`, and
 * the motion query.
 *
 * **The row is one row at every width.** Frames are hidden from the end as the
 * column narrows, and the measure is a `@container` query rather than
 * `mq('md')`: the room's content column is 360px narrower than its window
 * whenever chat is docked, so a wall that asked the window would lay four
 * frames into a 584px column at a 1024px viewport.
 *
 * **The cross-fade is CSS, not a timer.** Every layer runs the same animation
 * at the same duration, offset by an even fraction of it, so the browser owns
 * the schedule. A `setInterval` here would be a second clock on a screen that
 * deliberately runs one — see `RoomShell` — and it would drift from the frame
 * beside it the moment a tab was backgrounded.
 *
 * **It costs no extra lookup.** `resolveArt` holds one answer per slug set for
 * the life of the page, so a player who arrived through the landing wall has
 * already paid for these, and a room that plays ten rounds resolves them once.
 */
export function CycleWall({
  frames = 4,
  perFrame = 4,
  label = 'a wall of looping reaction GIFs',
}: CycleWallProps) {
  /**
   * The app has no art of its own to show here, unlike the landing wall.
   *
   * A server may not fetch a provider's media and its URLs may not be retained,
   * so every frame starts as a dead channel and improves. That is also exactly
   * what a keyless clone and the Playwright suite see, which is why the frames
   * are sized in CSS rather than by their contents — the row is the same shape
   * whether or not anything ever resolves.
   */
  const { art } = useResolvedArt(WALL_SLUGS)
  const bounds = useRef<HTMLDivElement>(null)
  const videos = useRef<HTMLVideoElement[]>([])
  // Reports stillness until it knows otherwise, so nothing plays before we
  // know whether it should.
  const stillPreferred = useReducedMotion()

  /**
   * One layer per frame until there is art, then the full stack.
   *
   * Cross-fading four dead channels is four times the work for a picture that
   * does not change — and a frame that is *tuning* is one state, not four.
   */
  const layers = art ? perFrame : 1
  const tiles: (WallTile | undefined)[] = art
    ? cycleTiles(art.map(toWallTile), frames * perFrame)
    : Array.from({ length: frames })

  useEffect(() => {
    function sweep() {
      for (const video of videos.current) {
        if (!video) continue
        /**
         * A frame the container query has dropped has no layout box at all, and
         * a clip nobody can see is a clip nobody should be decoding. With
         * `preload="none"` an untouched one never fetches a byte, so skipping
         * it here is the difference between four videos and sixteen on a phone
         * that is only showing one frame.
         */
        const shown = video.offsetParent !== null
        if (stillPreferred || !shown) video.pause()
        else void video.play().catch(() => undefined)
      }
    }

    sweep()

    // Which frames have a box is a layout answer, so it changes when the column
    // does — a rotate, a window drag, or the chat rail docking beside it. The
    // observer is on the measured box for the same reason the query is.
    const el = bounds.current
    if (!el) return
    const observer = new ResizeObserver(sweep)
    observer.observe(el)
    return () => observer.disconnect()
    // `art` is not read here either — it is the dependency that says *these are
    // different elements now*. The clips resolve over the network, so the
    // `<video>`s mount well after the motion preference has settled.
  }, [stillPreferred, art])

  return (
    <div ref={bounds} className={styles.bounds}>
      <div className={styles.wall} role="img" aria-label={label}>
        {Array.from({ length: frames }, (_, frame) => (
          <div key={frame} data-frame="" className={styles.frame}>
            {Array.from({ length: layers }, (_, layer) => {
              const index = frame * layers + layer
              const tile = tiles[index]
              /**
               * Where this layer sits in the cycle.
               *
               * Negative, so the wall opens mid-dissolve rather than with all
               * four frames blank for the first beat. The per-frame nudge is what
               * stops the row changing as one.
               */
              const delay = `calc(-1 * (${layer} * (var(--cycle-duration) / ${layers}) + ${frame} * var(--cycle-offset)))`
              const style = { '--cycle-delay': delay } as CSSProperties

              return (
                <div
                  key={layer}
                  /* A lone layer does not cycle. `gifCycle` hides its element for
                     three quarters of the loop so its neighbours can have their
                     turn — with no neighbours that is a frame which blinks off
                     and stays off, which is what a tuning wall did until this
                     distinguished the two. */
                  className={`${styles.layer} ${layers > 1 ? styles.cycling : ''}`}
                  style={layers > 1 ? style : undefined}
                >
                  {!tile ? (
                    <>
                      <TvStatic seed={index} paused={stillPreferred} />
                      {/* `TvStatic` is never shown raw — the wall, the backdrop and
                          the walkthrough's illustrations all veil it, because a
                          field of near-white grain at this size is the loudest
                          thing on the screen. No blur: under one the grain
                          flattens to grey and the channel stops reading as one. */}
                      <span className={styles.staticVeil} aria-hidden="true" />
                    </>
                  ) : tile.mp4 ? (
                    <video
                      ref={(el) => {
                        if (el) videos.current[index] = el
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

                       Swapping the file is the only way to stop an animated
                       image: CSS cannot reach inside one. Same call `HeroWall`
                       makes for a source that ships no video. */
                    <img
                      className={styles.media}
                      src={stillPreferred ? tile.poster : (tile.motion ?? tile.poster)}
                      alt=""
                      loading="lazy"
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}

      {/*
        Somebody else's art, credited — and read here rather than passed in, for
        the reason `HeroWall` gives about the same line: this renders on a screen
        that already has plenty to remember, and a prop threaded through is a
        prop a caller can forget. It appears only once real art has resolved,
        because until then there is nothing of theirs on screen.
      */}
      </div>

      {art && (
        <span className={styles.credit}>GIFs via {intendedProvider().descriptor.name}</span>
      )}
    </div>
  )
}
