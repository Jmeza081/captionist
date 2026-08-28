'use client'

import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import styles from './RevealReactionBar.module.scss'

export interface RevealReaction {
  id: string
  glyph: string
  label: string
}

export interface RevealReactionBarProps {
  /** One-tap reactions. Capped at five so the row can't overflow its column. */
  reactions: RevealReaction[]
  onReact: (id: string) => void
  /** Opens the full searchable toolbar. */
  onOpenToolbar?: () => void
  chosen?: string[]
}

/** Five is the cap the design sets, so the row fits a 440px column. */
const MAX = 5

/** Matches `.key`'s font size, so a picture sits where a character would. */
const KEY_GLYPH = 20

/**
 * The one-tap reaction row on the reveal screen.
 *
 * The five shortcuts are a convenience; the CTA beside them opens the same
 * searchable toolbar used everywhere else, so nothing is only reachable here.
 *
 * These five are `REVEAL_REACTIONS`, which slices the head of a list whose
 * first six are asserted to be characters — so this renders through
 * `ReactionGlyph` for the same reason the front door is locked on a quiet
 * street. The invariant is one edit away from not holding.
 */
export function RevealReactionBar({
  reactions,
  onReact,
  onOpenToolbar,
  chosen = [],
}: RevealReactionBarProps) {
  return (
    <div className={styles.bar}>
      <span className={styles.label}>React</span>

      {reactions.slice(0, MAX).map((r) => (
        <button
          key={r.id}
          type="button"
          className={`${styles.key} ${chosen.includes(r.id) ? styles.chosen : ''}`}
          onClick={() => onReact(r.id)}
          aria-label={`React with ${r.label}`}
          aria-pressed={chosen.includes(r.id)}
        >
          <span aria-hidden="true">
            <ReactionGlyph glyph={r.glyph} size={KEY_GLYPH} />
          </span>
        </button>
      ))}

      {onOpenToolbar && (
        <ReactionCTA onClick={onOpenToolbar} className={styles.more} />
      )}
    </div>
  )
}
