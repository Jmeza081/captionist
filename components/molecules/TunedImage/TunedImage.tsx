'use client'

import { useEffect, useRef, useState } from 'react'
import { TvStatic } from '@/components/atoms/TvStatic'
import styles from './TunedImage.module.scss'

export interface TunedImageProps {
  src: string
  /** Empty where the wrapping control already carries the name — a picker tile. */
  alt: string
  /** Goes to the image, so a call site's existing rules keep matching it. */
  className?: string
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
  /**
   * Draw a set behind it while the picture is on its way.
   *
   * Off where there is nothing coming — a card whose entry carries no media at
   * all is a settled nothing, not a wait, and `SceneBackdrop` documents why
   * those two must not look the same.
   */
  tuning?: boolean
}

/**
 * A picture arriving on a television, rather than into a hole.
 *
 * Every remote GIF in this app has a gap between its tile being laid out and
 * its bytes painting, and until now only two surfaces filled it: the landing
 * wall and the waiting backdrop. A picker board is fifty tiles, lazily loaded,
 * and a vote grid is up to nineteen cards — all of which reserved the right
 * shape and then showed a transparent box inside it.
 *
 * So this is `HeroWall`'s cell, made available to anything that draws one
 * image: `TvStatic` behind, the picture over it, and the static gone the
 * moment the picture is there.
 *
 * **Dropped on load, never on error.** A GIF the provider has pulled, or a CDN
 * that does not answer, simply never fires `onLoad` and keeps its dead channel
 * — which is the honest picture of a set that never tuned in, and costs no
 * error handling to get. It is the one place this parts company with
 * `SceneBackdrop`, whose failure settles to nothing: a full-bleed backdrop
 * hissing forever is a distraction behind the words, where a tile in a grid has
 * to be *something* or it is the hole this component exists to fill. That split
 * is [ADR 0027](../../../docs/adr/0027-a-tile-that-never-tunes-in-keeps-hissing.md).
 *
 * `'use client'` for exactly one boolean, and no more of the tree than that:
 * `MediaCard` and `GifPanel`'s tile keep the rest of their markup on the
 * server.
 *
 * A molecule because it composes `TvStatic`, which is the rule that promoted
 * `SceneBackdrop` and `Wordmark` before it — the tier is decided by dependency,
 * not by size.
 */
export function TunedImage({
  src,
  alt,
  className,
  loading,
  decoding,
  tuning = true,
}: TunedImageProps) {
  const picture = useRef<HTMLImageElement>(null)
  const [tuned, setTuned] = useState(false)

  /**
   * The picture may already be there before React is listening.
   *
   * `onLoad` alone is a race this loses often: a cached GIF, a `data:` URI, or
   * anything that decodes inside the server HTML has finished loading before
   * hydration attaches the handler, so the event never arrives and the static
   * sits on top of a perfectly good picture forever. It is the failure that
   * looks exactly like the component working, and it is why this is a ref and
   * an effect rather than one `useState`.
   *
   * `naturalWidth` is the half that keeps the error case honest: a broken image
   * is `complete` too, and reports zero.
   */
  useEffect(() => {
    const el = picture.current
    setTuned(Boolean(el?.complete && el.naturalWidth > 0))
  }, [src])

  return (
    /**
     * A wrapper, for two reasons that are both invisible until it is missing.
     *
     * `TvStatic` is `position: absolute`, and a positioned element paints above
     * an unpositioned block whatever the DOM order says — so without a box of
     * our own to put both of them in and a `position` on the image, the static
     * covers the picture rather than the other way round.
     *
     * The size still comes from the image, whichever shape it is. A fluid tile
     * declares `aspect-ratio` and `width: 100%` on it; a fixed thumb declares a
     * width and a height. This box takes its own size from that in both cases —
     * see the stylesheet for why it declares no width of its own. Nothing about
     * a call site's shape moves in here.
     */
    <span
      className={styles.tuner}
      /**
       * Marks the box while the set is up.
       *
       * For the one call site whose image reserves nothing: a chat attachment
       * is `width: auto; height: auto` on purpose, so a 64px Slackmoji is not
       * stretched into a 180px banner — which also means it is a zero-height
       * box until its bytes land, and a set with no box has nothing to paint
       * in. `ChatMessage` reserves the design's attachment height off this
       * attribute, and nothing else needs to.
       */
      data-tuning={tuning && !tuned ? '' : undefined}
    >
      {/*
        Gone once the picture is there.

        Not merely covered, which would be the cheaper-looking version and is
        wrong twice over. `MediaCard` draws an unselected image at 85%, so
        static underneath would show through every card on a vote grid. And the
        field repaints five times every 200ms — fifty of those under fifty
        loaded GIFs, forever, is a bill for a picture nobody can see.
      */}
      {tuning && !tuned && (
        <>
          <TvStatic seed={seedFor(src)} />
          <span className={styles.veil} />
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- remote and
          animated; next/image would rasterise it. */}
      <img
        ref={picture}
        className={className}
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={() => setTuned(true)}
      />
    </span>
  )
}

/**
 * Which set this one is, from the only thing every call site already has.
 *
 * `TvStatic`'s `seed` exists so neighbouring televisions are never showing the
 * same field at the same instant — twenty in lockstep read as one sheet of
 * noise behind the page rather than as a grid of sets, and a picker board is
 * fifty. Deriving it from the URL desynchronises any grid without threading an
 * index through two components that otherwise have no use for one.
 *
 * Pure, so the server's render and the browser's agree. Twenty is the wall's
 * count, which is as many distinct offsets as the effect was ever tuned for.
 */
function seedFor(src: string): number {
  let hash = 0
  for (let i = 0; i < src.length; i++) hash = (hash * 31 + src.charCodeAt(i)) | 0
  return Math.abs(hash) % 20
}
