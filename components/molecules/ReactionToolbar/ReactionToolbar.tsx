'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@/components/atoms/Icon'
import { TextField } from '@/components/atoms/TextField'
import styles from './ReactionToolbar.module.scss'

export interface Reaction {
  id: string
  /** The emoji character, or a URL for a Slackmoji GIF. */
  glyph: string
  /** `gif` renders the glyph as an image tile. */
  kind?: 'emoji' | 'gif'
  /** Search terms. The design matches on keywords, not just the character. */
  keywords: string[]
  label: string
}

export interface ReactionToolbarProps {
  /** Names what's being reacted to — "React to this caption". */
  title: string
  /** The full set. Unsearched, the first ten show as defaults. */
  reactions: Reaction[]
  /** Reactions this player has already added. */
  chosen?: string[]
  onPick: (reaction: Reaction) => void
  /** Flips to bottom-anchored in the lower third of a list. */
  flipped?: boolean
}

/** Unsearched, the panel shows this many. From the design: 6 emoji + 4 GIFs. */
const DEFAULT_COUNT = 10

/**
 * The searchable reaction picker, in a popover.
 *
 * One component with three anchors (room, message, card) — the reaction
 * affordance is uniform everywhere, so the panel behind it is too.
 */
export function ReactionToolbar({
  title,
  reactions,
  chosen = [],
  onPick,
  flipped = false,
}: ReactionToolbarProps) {
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return reactions.slice(0, DEFAULT_COUNT)
    return reactions.filter((r) =>
      r.keywords.some((k) => k.toLowerCase().includes(q)),
    )
  }, [query, reactions])

  return (
    <div
      className={`${styles.toolbar} ${flipped ? styles.flipped : ''}`}
      role="dialog"
      aria-label={title}
    >
      <span className={styles.title}>{title}</span>

      <TextField
        size="popover"
        placeholder="Search all emoji"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        icon={<Icon name="search" size={13} />}
        aria-label="Search reactions"
      />

      {shown.length === 0 ? (
        <p className={styles.empty}>
          Nothing matches &ldquo;{query}&rdquo;. Try a shorter word.
        </p>
      ) : (
        <div className={styles.grid}>
          {shown.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${styles.tile} ${chosen.includes(r.id) ? styles.chosen : ''}`}
              onClick={() => onPick(r)}
              aria-label={r.label}
              aria-pressed={chosen.includes(r.id)}
            >
              {r.kind === 'gif' ? (
                // Animated Slackmoji — next/image would rasterise it.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.glyph} alt="" className={styles.gif} />
              ) : (
                <span aria-hidden="true">{r.glyph}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
