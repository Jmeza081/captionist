import type { ReactNode } from 'react'
import styles from './MediaCard.module.scss'

export interface MediaCardProps {
  /** The GIF or image. */
  src: string
  /** Describes the image for anyone who can't see it. */
  alt: string
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
  /** Picked by this player. */
  selected?: boolean
  /** The round's winner: bigger radius, 4px ring, drop shadow. */
  winner?: boolean
  /** Reaction tallies, bottom-left. */
  tallies?: ReactNode
  /** The reaction affordance, rendered under the card. */
  action?: ReactNode
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
  topText,
  bottomText,
  rank,
  own = false,
  selected = false,
  winner = false,
  tallies,
  action,
  caption,
}: MediaCardProps) {
  const frameClasses = [
    styles.frame,
    rank ? styles[`rank${rank}`] : '',
    selected ? styles.selected : '',
    winner ? styles.winner : '',
    own ? styles.own : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <figure className={styles.card}>
      <div className={frameClasses}>
        {/* eslint-disable-next-line @next/next/no-img-element -- GIFs from
            Giphy are remote and animated; next/image would rasterise them. */}
        <img className={styles.image} src={src} alt={alt} />

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
            <span className={styles.ownLabel}>Your own answer</span>
          </span>
        )}

        {tallies && <div className={styles.tallies}>{tallies}</div>}
      </div>

      {(caption || action) && (
        <figcaption className={styles.foot}>
          {caption && <span className={styles.captionText}>{caption}</span>}
          {action}
        </figcaption>
      )}
    </figure>
  )
}

function ordinal(rank: 1 | 2 | 3): string {
  return rank === 1 ? 'first' : rank === 2 ? 'second' : 'third'
}
