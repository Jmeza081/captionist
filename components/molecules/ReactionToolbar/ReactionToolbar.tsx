'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@/components/atoms/Icon'
import { TextField } from '@/components/atoms/TextField'
import { pushRecent, readRecent } from '@/lib/recent-reactions'
import type { Reaction, ReactionPack } from '@/lib/reactions'
import styles from './ReactionToolbar.module.scss'

// The room's own type, not this component's. `lib/` owns state and
// `components/` is UI, so the reaction set and its shape live together in
// `lib/reactions.ts` and the picker reads both from there.
export type { Reaction }

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
 * The tabs, in the design's order.
 *
 * `recent` is not a `ReactionPack` because nothing is *authored* into it — it
 * is this browser's own history, so it lives beside the packs rather than
 * among them.
 */
const TABS: readonly { id: 'recent' | ReactionPack; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'slackmojis', label: 'Slackmojis' },
  { id: 'smileys', label: 'Smileys' },
  { id: 'objects', label: 'Objects' },
]

/**
 * The searchable reaction picker, in a popover.
 *
 * One component with three anchors (room, message, card) — the reaction
 * affordance is uniform everywhere, so the panel behind it is too.
 *
 * **Three views, in priority order.** A search beats a tab, and a tab beats the
 * default grid:
 *
 * - nothing chosen → the first ten, which DESIGNSYSTEM §4.4 defines as 6 emoji
 *   plus the 4 Slackmojis;
 * - a tab → the whole pack, uncapped, because the point of a tab is to see the
 *   pack and capping it at ten would defeat it;
 * - a query → the full set matched on keywords, with the tab cleared. §4.4
 *   makes search the long-tail answer, so it cannot be narrowed by a tab.
 *
 * That priority is also what keeps an empty Recent out of the way: it is never
 * the opening view, only somewhere you go.
 */
export function ReactionToolbar({
  title,
  reactions,
  chosen = [],
  onPick,
  flipped = false,
}: ReactionToolbarProps) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'recent' | ReactionPack | undefined>(undefined)
  /**
   * Read when the tab is opened, not on mount.
   *
   * `localStorage` does not exist on the server, so reading it during render
   * would make the two passes disagree — and reading it in an effect is the
   * setState-in-effect React 19 rightly complains about. Recent is only ever
   * needed the moment somebody asks for it, so that is when it is read.
   */
  const [recent, setRecent] = useState<readonly string[]>([])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) return reactions.filter((r) => r.keywords.some((k) => k.toLowerCase().includes(q)))
    if (tab === 'recent') {
      return recent
        .map((id) => reactions.find((r) => r.id === id))
        .filter((r): r is Reaction => r !== undefined)
    }
    if (tab) return reactions.filter((r) => r.pack === tab)
    return reactions.slice(0, DEFAULT_COUNT)
  }, [query, tab, recent, reactions])

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

      {/*
        A group of toggles, not a `tablist`. A real tablist promises arrow-key
        movement between panels, and a search overrides the panel entirely —
        so the promise would be false the moment anyone typed.
      */}
      <div className={styles.tabs} role="group" aria-label="Reaction packs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${tab === t.id && !query ? styles.tabActive : ''}`}
            aria-pressed={tab === t.id && !query}
            onClick={() => {
              setQuery('')
              if (t.id === 'recent') setRecent(readRecent())
              setTab((open) => (open === t.id ? undefined : t.id))
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>
          {query ? (
            <>Nothing matches &ldquo;{query}&rdquo;. Try a shorter word.</>
          ) : (
            <>Nothing here yet. Pick one and it&rsquo;ll show up.</>
          )}
        </p>
      ) : (
        <div className={styles.grid} role="group" aria-label="Reactions">
          {shown.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${styles.tile} ${chosen.includes(r.id) ? styles.chosen : ''}`}
              onClick={() => {
                // Here rather than at each of the three call sites, so every
                // anchor feeds Recent without being told to.
                setRecent(pushRecent(r.id))
                onPick(r)
              }}
              aria-label={r.label}
              aria-pressed={chosen.includes(r.id)}
            >
              {r.kind === 'image' ? (
                // The app's own art — next/image would rasterise the animation.
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
