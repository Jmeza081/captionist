import type { CSSProperties, ReactNode } from 'react'
import { TunedImage } from '@/components/molecules/TunedImage'
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
  /**
   * Clicking the image does what the foot's `action` does.
   *
   * The affordance the vote grid was missing: a card is a picture of a joke,
   * and the picture is what people reach for — the small button under it was
   * the only way to rank one. Pointer-only on purpose. It is a *second* route
   * to an action the foot already carries, so it is `aria-hidden` and out of
   * the tab order rather than a duplicate control announcing itself twice; the
   * keyboard route is the labelled button underneath, which stays.
   */
  onActivate?: () => void
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
  onActivate,
}: MediaCardProps) {
  // A card with no image at all. The round's own timeout no longer produces
  // one — the reducer picks off the offline shelf now — but an entry can still
  // arrive without media, and a broken frame is worse than the alt text used
  // as the content.
  const missing = !hasImage(src)
  const aspect = mediaAspect({ width, height })

  const frameClasses = [
    styles.frame,
    missing ? styles.missing : '',
    rank ? styles[`rank${rank}`] : '',
    selected ? styles.selected : '',
    winner ? styles.winner : '',
    own ? styles.own : '',
    onActivate ? styles.activatable : '',
  ]
    .filter(Boolean)
    .join(' ')

  const overlayClasses = (edge: string, text: string): string =>
    [styles.overlay, edge, overlayStep(text)].filter(Boolean).join(' ')

  return (
    <figure className={styles.card}>
      <div
        className={frameClasses}
        // The CSS owns the fallback, so an unknown ratio sets nothing at all
        // rather than a number this file and the stylesheet could disagree on.
        style={aspect ? ({ '--media-aspect': `${aspect}` } as CSSProperties) : undefined}
      >
        {/*
          A set behind it until the picture lands.

          `tuning={!missing}` is the load-bearing half: `hasImage` has already
          decided there is no media at all here, and that is a settled nothing
          rather than a wait — the `.fallback` below says so in words, and a
          card cannot be doing both. It is `SceneBackdrop`'s rule (tuning and no
          clip is static; settled and no clip is nothing) applied to a card.
        */}
        <TunedImage
          className={styles.image}
          src={imageSrc(src)}
          alt={missing ? '' : alt}
          tuning={!missing}
        />

        {missing && <span className={styles.fallback}>{alt}</span>}

        {topText && <span className={overlayClasses(styles.top, topText)}>{topText}</span>}
        {bottomText && (
          <span className={overlayClasses(styles.bottom, bottomText)}>{bottomText}</span>
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

        {onActivate && (
          <button
            type="button"
            className={styles.hit}
            onClick={onActivate}
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
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

/**
 * Which type step a caption needs, from its length alone.
 *
 * No measuring, and therefore no effect, no ref and no `'use client'`: the
 * overlay is sized in `cqw`, so a card holds about the same number of
 * characters per line whatever its pixel width, and the line count falls out of
 * the character count. Capped at the fourth step, which is where `CAPTION_MAX`
 * lands.
 *
 * Twenty is measured against the 800-weight uppercase sans the overlay is set
 * in, not guessed: at 8cqw an average glyph advances about 0.55em, so a card
 * fits `1 / (0.08 * 0.55)` ≈ 22 of them, less the padding either side. It lives
 * here rather than in `theme/_metrics.scss` because no stylesheet can read it —
 * a token nothing consumes is a number that drifts from the one that runs. It
 * is still a property of `$media-overlay-size`, so changing that type means
 * re-measuring this.
 */
const CHARS_PER_LINE = 20

function overlayStep(text: string): string {
  const lines = Math.ceil(text.trim().length / CHARS_PER_LINE)
  if (lines <= 1) return ''
  if (lines === 2) return styles.lines2 ?? ''
  if (lines === 3) return styles.lines3 ?? ''
  return styles.lines4 ?? ''
}

function ordinal(rank: 1 | 2 | 3): string {
  return rank === 1 ? 'first' : rank === 2 ? 'second' : 'third'
}
