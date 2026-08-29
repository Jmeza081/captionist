import type { CSSProperties, ReactNode } from 'react'
import { hasImage, imageSrc, mediaAspect } from '@/lib/media'
import styles from './MediaCard.module.scss'

export interface MediaCardProps {
  /** The GIF or image. */
  src: string
  /** Describes the image for anyone who can't see it. */
  alt: string
  /**
   * The image's intrinsic size, from `MediaRef`.
   *
   * The card is drawn at that ratio, clamped by `mediaAspect` — see the band
   * in `lib/media.ts`. Passed rather than measured because measuring means
   * waiting for the image, and a card that resized on load would move a
   * caption somebody was already typing. Absent, the card is square, which is
   * what it always was.
   */
  width?: number
  height?: number
  /**
   * Caption overlays. Caption mode draws them over the shared image; react
   * mode leaves them off, because the image *is* the answer.
   */
  topText?: string
  bottomText?: string
  /** 1, 2 or 3 — draws the ring and the corner badge. */
  rank?: 1 | 2 | 3
  /** This is the player's own entry, so it can't be voted for. */
  own?: boolean
  /**
   * What the scrim over your own entry calls it. The design says "caption" in
   * one mode and "answer" in the other, and that branch belongs in a selector
   * rather than in here — a component that knows the mode has forked.
   */
  ownLabel?: string
  /** Picked by this player. */
  selected?: boolean
  /** The round's winner: bigger radius, 4px ring, drop shadow. */
  winner?: boolean
  /** Reaction tallies, bottom-left. */
  tallies?: ReactNode
  /** The card's primary action under the foot — ranking it, usually. */
  action?: ReactNode
  /**
   * The reaction affordance, beside the action.
   *
   * Its own slot rather than something the caller nests inside `action`,
   * because the design draws label, action and reaction as three things
   * sharing one row — and because `action` is already spoken for by the rank
   * button on every card in a vote grid.
   */
  reaction?: ReactNode
  /**
   * The reply affordance, beside the reaction.
   *
   * Its own slot for the same reason `reaction` has one: the design draws the
   * foot as peers sharing a row, and `action` is already spoken for by the rank
   * button on every card in a vote grid. **The design draws no reply control** —
   * only the message it produces (Screens 2c) — so this slot is ours, and the
   * row it joins was drawn with three things in it.
   */
  reply?: ReactNode
  /** Caption label under the card. */
  caption?: string
}

/**
 * One entry in a vote grid, in either mode.
 *
 * Six states from one component: default, ranked, own, selected, winner, and
 * the react-mode variant that simply omits the overlays.
 */
export function MediaCard({
  src,
  alt,
  width,
  height,
  topText,
  bottomText,
  rank,
  own = false,
  ownLabel = 'Your own answer',
  selected = false,
  winner = false,
  tallies,
  action,
  reaction,
  reply,
  caption,
}: MediaCardProps) {
  // A round whose clock ran out has a subject with no image. Rather than a
  // broken frame, the alt text becomes the content — it already says what
  // happened ("No image was picked in time").
  const missing = !hasImage(src)
  const aspect = mediaAspect({ width, height })

  const frameClasses = [
    styles.frame,
    missing ? styles.missing : '',
    rank ? styles[`rank${rank}`] : '',
    selected ? styles.selected : '',
    winner ? styles.winner : '',
    own ? styles.own : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <figure className={styles.card}>
      <div
        className={frameClasses}
        // The CSS owns the fallback, so an unknown ratio sets nothing at all
        // rather than a number this file and the stylesheet could disagree on.
        style={aspect ? ({ '--media-aspect': `${aspect}` } as CSSProperties) : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- GIFs from
            Giphy are remote and animated; next/image would rasterise them. */}
        <img className={styles.image} src={imageSrc(src)} alt={missing ? '' : alt} />

        {missing && <span className={styles.fallback}>{alt}</span>}

        {topText && <span className={`${styles.overlay} ${styles.top}`}>{topText}</span>}
        {bottomText && (
          <span className={`${styles.overlay} ${styles.bottom}`}>{bottomText}</span>
        )}

        {rank && (
          <span className={styles.badge} aria-label={`Ranked ${ordinal(rank)}`}>
            {rank}
          </span>
        )}

        {selected && <span className={styles.yours}>Your answer</span>}

        {own && (
          <span className={styles.ownScrim}>
            <span className={styles.ownLabel}>{ownLabel}</span>
          </span>
        )}

        {tallies && <div className={styles.tallies}>{tallies}</div>}
      </div>

      {(caption || action || reaction || reply) && (
        <figcaption className={styles.foot}>
          {caption && <span className={styles.captionText}>{caption}</span>}
          {reply}
          {reaction}
          {action}
        </figcaption>
      )}
    </figure>
  )
}

function ordinal(rank: 1 | 2 | 3): string {
  return rank === 1 ? 'first' : rank === 2 ? 'second' : 'third'
}
