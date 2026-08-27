'use client'

import { ReactionCTA } from '@/components/atoms/ReactionCTA'
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

/**
 * The one-tap reaction row on the reveal screen.
 *
 * The five shortcuts are a convenience; the CTA beside them opens the same
 * searchable toolbar used everywhere else, so nothing is only reachable here.
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
          <span aria-hidden="true">{r.glyph}</span>
        </button>
      ))}

      {onOpenToolbar && (
        <ReactionCTA onClick={onOpenToolbar} className={styles.more} />
      )}
    </div>
  )
}
