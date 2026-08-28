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
  /**
   * Whether the picker is showing.
   *
   * Controlled rather than mounted and unmounted by the caller, because a
   * panel that animates *out* has to outlive the decision to close it. The
   * component still renders nothing once the exit has finished.
   */
  open?: boolean
  /**
   * Names what's being reacted to — "React to this caption".
   *
   * The accessible name only. It used to print above the grid as well, which
   * the design draws and use disproved: you open this from the thing you are
   * reacting to, so the panel was spending a line restating what the last tap
   * already said.
   */
  title: string
  /** The full set. Unsearched, the first ten show as defaults. */
  reactions: Reaction[]
  /** Reactions this player has already added. */
  chosen?: string[]
  onPick: (reaction: Reaction) => void
  /**
   * Close without picking — Escape, or a click anywhere outside the panel.
   *
   * Owned here rather than at each anchor because the panel is the thing that
   * knows where its own edges are. Without it the picker was a trap: it opened
   * on the CTA and only that same CTA could put it away.
   */
  onDismiss?: () => void
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
 * How long the exit runs before the panel is actually gone.
 *
 * A timer rather than `animationend`, because `prefers-reduced-motion` removes
 * the animation and with it the event — and a picker that never unmounts for
 * the people who asked for less motion is the worst version of this.
 * Comfortably longer than `$duration-genie-out`.
 */
const EXIT_MS = 220

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
  open = true,
  title,
  reactions,
  chosen = [],
  onPick,
  onDismiss,
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

  /**
   * Leaving, which is not the same as closed.
   *
   * `open` is the caller's intent; this is the tail after it goes false, and
   * the panel is on screen for both. Adjusted during render off a previous
   * value rather than in an effect — the pattern React documents for state
   * derived from a prop — because an effect that sets state on the way in is a
   * cascading render, and this one would run on every open.
   */
  const [exiting, setExiting] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    setExiting(!open)
  }
  const rendered = open || exiting

  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => {
      setExiting(false)
      // A fresh open starts on the default grid rather than wherever the last
      // one was left.
      setQuery('')
      setTab(undefined)
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [exiting])

  /*
    Escape, or a click anywhere else.

    `click` rather than `pointerdown` so the affordance that opened this can
    still close it: the anchor's own handler toggles first and this then agrees
    with it, where a pointerdown listener would close the panel and let the
    click that followed reopen it. Registered from an effect, which runs after
    the click that opened the panel has finished dispatching — so it cannot
    close on the way in.
  */
  useEffect(() => {
    if (!open || !onDismiss) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    const onClick = (event: MouseEvent) => {
      const el = panel.current
      if (el && event.target instanceof Node && !el.contains(event.target)) onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onClick)
    }
  }, [open, onDismiss])

  if (!rendered) return null

  return (
    <div
      ref={panel}
      className={[styles.toolbar, flipped ? styles.flipped : '', open ? styles.in : styles.out]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-label={title}
    >
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
