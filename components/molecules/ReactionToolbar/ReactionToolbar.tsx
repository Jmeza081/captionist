'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/atoms/Icon'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import { TextField } from '@/components/atoms/TextField'
import { pushRecent, readRecent } from '@/lib/recent-reactions'
import { matchesQuery, type Reaction, type ReactionPack } from '@/lib/reactions'
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
 * How many tiles a pack or a search renders before the next scroll extends it.
 *
 * The packs used to render whole, which was right at fourteen tiles and is not
 * at 224: every tile near the viewport reaches for a ~369KB animation, so an
 * uncapped grid is the difference between a picker and a stall. Twelve rows of
 * five, so there is always more below the fold to scroll toward.
 */
const PAGE = 60

/** Extend the grid slightly before the sentinel is actually reached. */
const ROOT_MARGIN = '120px'

/** The tile art, matching `$gif-thumb`. */
const TILE_GLYPH = 22

/**
 * The tabs, in the design's order.
 *
 * `recent` is not a `ReactionPack` because nothing is *authored* into it — it
 * is this browser's own history, so it lives beside the packs rather than
 * among them.
 *
 * `nature` and `places` arrived with the imported catalog: Noto's nine
 * categories fold into four packs, because the row has room for six chips and
 * not for eleven. The row scrolls sideways rather than wrapping, so the panel
 * keeps its height whatever is in it.
 */
const TABS: readonly { id: 'recent' | ReactionPack; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'slackmojis', label: 'Slackmojis' },
  { id: 'smileys', label: 'Smileys' },
  { id: 'nature', label: 'Nature' },
  { id: 'objects', label: 'Objects' },
  { id: 'places', label: 'Places' },
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
 * - a tab → the whole pack, a page at a time;
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

  const trimmed = query.trim().toLowerCase()

  const shown = useMemo(() => {
    if (trimmed) return reactions.filter((r) => matchesQuery(r, trimmed))
    if (tab === 'recent') {
      return recent
        .map((id) => reactions.find((r) => r.id === id))
        .filter((r): r is Reaction => r !== undefined)
    }
    if (tab) return reactions.filter((r) => r.pack === tab)
    return reactions.slice(0, DEFAULT_COUNT)
  }, [trimmed, tab, recent, reactions])

  /**
   * How far into the current view we've scrolled.
   *
   * Stamped with the view it belongs to rather than reset in an effect, so
   * switching tab or typing starts from the top by derivation instead of by a
   * render-then-correct.
   */
  const view = trimmed ? `q:${trimmed}` : tab ? `t:${tab}` : 'default'
  const [paged, setPaged] = useState({ view, limit: PAGE })
  const limit = paged.view === view ? paged.limit : PAGE

  const visible = shown.slice(0, limit)
  const more = shown.length > limit

  const sentinel = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!more) return
    const el = sentinel.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setPaged({ view, limit: limit + PAGE })
      },
      { root: grid.current, rootMargin: ROOT_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [more, view, limit])

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
        <div className={styles.grid} ref={grid} role="group" aria-label="Reactions">
          {visible.map((r) => (
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
              {/*
                The atom, not a second copy of its branch. This component having
                its own was how the burst layer ended up printing URLs as text.
              */}
              <span className={styles.face} aria-hidden="true">
                <ReactionGlyph glyph={r.glyph} size={TILE_GLYPH} />
              </span>
            </button>
          ))}
          {more && <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}
