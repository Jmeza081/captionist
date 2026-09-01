'use client'

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Button } from '@/components/atoms/Button'
import { Chip } from '@/components/atoms/Chip'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { TextField } from '@/components/atoms/TextField'
import type { GifAd, GifProviderDescriptor } from '@/lib/gifs/provider'
import { AdSlot } from './AdSlot'
import type { GifResult } from '@/lib/gifs/types'
import styles from './GifPanel.module.scss'

export type { GifResult }

/**
 * Where the panel is being used.
 *
 * `popover` is the composer's attach-a-GIF surface: a small dialog that filters
 * a fixed list it was handed, and closes as soon as you pick. `board` is the
 * same search at page scale — a server-fed grid on the brief and compose
 * screens that keeps its selection rather than closing.
 *
 * One component with a variant rather than two, because the tile, the
 * selection affordance and the empty state are identical in both, and the day
 * one of them changes is the day two copies drift.
 */
export type GifPanelVariant = 'popover' | 'board'

export interface GifPanelProps {
  results: readonly GifResult[]
  /** Attaches and, in the popover, closes. It never sends on its own. */
  onPick: (gif: GifResult) => void
  onClose?: () => void
  /** The one currently staged. */
  selectedId?: string
  variant?: GifPanelVariant

  /**
   * Controlled query. Supply it with `onSubmit` when a server is doing the
   * searching; leave both off and the panel filters `results` locally, which
   * is what the composer wants.
   */
  query?: string
  onQueryChange?: (query: string) => void
  onSubmit?: (query: string) => void

  /** One-tap searches under the field. */
  suggestions?: readonly string[]
  /**
   * Another board for the same query — the design's "Shuffle results".
   *
   * Sits with the suggestion chips rather than in the screen's action row,
   * because it changes what the board shows rather than ending the phase, and
   * because putting it here means both variants get it from one place. Omit it
   * on a surface handed a fixed list, which has no next page to turn to.
   */
  onMore?: () => void
  status?: 'loading' | 'ready' | 'error'
  /** Shown under the field — an error, or a note that these are samples. */
  message?: string
  /** Extra control beside the field. "Surprise me" lives here. */
  tools?: ReactNode
  /** The badge on the chosen tile: "Selected" when picking, "Your answer" when answering. */
  selectionLabel?: string
  /**
   * Who supplied `results`, or `undefined` for the offline shelf.
   *
   * Drives the attribution mark, which is not decoration: every provider's
   * terms require it "where the API is utilized", and putting it in the
   * component that draws their content is what stops the next board forgetting
   * it. Carrying the descriptor rather than a provider name makes "never credit
   * anyone over the offline shelf" structural — there is nothing to render
   * because there is nobody to credit — where a `source === 'giphy'` string
   * comparison had to be remembered, and was already wrong in the gallery.
   */
  provider?: GifProviderDescriptor
  /**
   * Ads that came with `results`, rendered in a slot above the board.
   *
   * Never mixed into the grid — `AdSlot` carries the reasoning. Omit them and
   * the panel simply has none, which is the ordinary case.
   */
  ads?: readonly GifAd[]
}

export function GifPanel({
  results,
  onPick,
  onClose,
  selectedId,
  variant = 'popover',
  query,
  onQueryChange,
  onSubmit,
  suggestions,
  onMore,
  status = 'ready',
  message,
  tools,
  selectionLabel = 'Selected',
  provider,
  ads,
}: GifPanelProps) {
  const [localQuery, setLocalQuery] = useState('')
  const controlled = query !== undefined
  const value = controlled ? query : localQuery

  const shown = useMemo(() => {
    /**
     * A provider's results are rendered exactly as they arrived.
     *
     * Two reasons, and the second is not optional. Filtering a server-backed
     * search again locally would hide results that matched for reasons the
     * title does not say — and both providers forbid it outright: "do not
     * independently reorder, insert, remove, suppress, replace, or filter
     * returned results".
     *
     * Keyed on `provider` as well as `onSubmit`, because `onSubmit` describes
     * how this surface searches and `provider` describes whose content it is
     * holding. The popover has no `onSubmit` and filters the fixed list it was
     * handed, which is fine while that list is ours — and would quietly become
     * a violation the first time one is fed from a provider, which is exactly
     * what returning GIF replies to chat would do.
     */
    if (onSubmit || provider) return results
    const q = localQuery.trim().toLowerCase()
    if (!q) return results
    return results.filter((r) => r.keywords.some((k) => k.toLowerCase().includes(q)))
  }, [localQuery, results, onSubmit, provider])

  const board = variant === 'board'

  const field = (
    <TextField
      size={board ? 'search' : 'popover'}
      primary={board}
      /**
       * The provider's wording wins, and on the board it costs something.
       *
       * The board used to read `deploy on friday` — an example query, which
       * teaches what to type in a way "Search X" does not. KLIPY's attribution
       * terms fix the placeholder as exactly `Search KLIPY`, and a required
       * mark outranks a nicety. The example survives as the first suggestion
       * chip directly underneath. Over the offline shelf there is no provider
       * to obey, so the example stays.
       */
      placeholder={provider?.searchPlaceholder ?? (board ? 'deploy on friday' : 'Search GIFs…')}
      value={value}
      onChange={(e) => {
        if (controlled) onQueryChange?.(e.target.value)
        else setLocalQuery(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onSubmit) {
          e.preventDefault()
          onSubmit(value)
        }
      }}
      icon={<Icon name="search" size={board ? 18 : 13} />}
      /**
       * Generic, and deliberately not the provider's name.
       *
       * The placeholder above carries the brand, which is what the terms
       * actually require. An accessible name that changed with a build-time
       * env var would be untestable — the same spec would need a different
       * locator per provider — and it would churn again on the next one. A
       * placeholder is a hint rather than a visible label, so nothing here
       * disagrees with what a sighted user reads.
       */
      aria-label="Search GIFs"
    />
  )

  const tiles = (
    <div className={board ? styles.board : styles.grid}>
      {shown.map((gif) => (
        <button
          key={gif.id}
          type="button"
          className={`${styles.tile} ${gif.id === selectedId ? styles.selected : ''}`}
          /**
           * The GIF's own shape, reserved before it loads.
           *
           * A ratio rather than a height, because the column is fluid and a
           * height would only be right at one width. `--tile-ratio` falls back
           * to a stated default in the stylesheet when a source reports no
           * dimensions, so an unknown GIF still gets a tile rather than a
           * zero-height one.
           */
          style={
            gif.width && gif.height
              ? ({ '--tile-ratio': `${gif.width} / ${gif.height}` } as CSSProperties)
              : undefined
          }
          onClick={() => onPick(gif)}
          aria-label={board ? `Pick ${gif.alt}` : `Attach ${gif.alt}`}
          aria-pressed={gif.id === selectedId}
        >
          {/*
            `webp` first, and lazily.

            The board asks for fifty tiles now rather than twelve — a board of
            fifty costs the same one API call, and every tile on it is a search
            somebody does not have to run. Fifty *animated GIFs* decoding at
            once on a phone is tens of megabytes, though, so neither half of
            this is optional: `loading="lazy"` leans on the board already being
            its own scroller, and the WebP rendition of the same animation is a
            fraction of the bytes. `src` stays the fallback for a source that
            reports no WebP — and stays what `toMediaRef` broadcasts, because
            the room's other screens are not all WebP-safe.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gif.webp ?? gif.src} alt="" loading="lazy" decoding="async" />
          {board && gif.id === selectedId && (
            <span className={styles.badge}>{selectionLabel}</span>
          )}
        </button>
      ))}
    </div>
  )

  const grid =
    shown.length === 0 ? (
      <p className={styles.empty}>
        {status === 'error'
          ? (message ?? 'That search didn\u2019t come back. Try again.')
          : status === 'loading'
            ? 'Looking\u2026'
            : `No GIFs for \u201c${value}\u201d. Try a shorter word.`}
      </p>
    ) : board ? (
      // The board grows with the page, so it is its own scroller.
      tiles
    ) : (
      /**
       * The popover's scroller is a *wrapper*, never the columns themselves.
       *
       * A multicol box with a capped height treats that height as its
       * fragmentainer: it fills the first column to the cap, then the second,
       * then keeps laying out sideways past the edge of the panel — three
       * tiles visible and the other nine off-screen. Letting the columns take
       * their natural height and scrolling the box around them is what makes
       * the list vertical again.
       */
      <div className={styles.gridScroll}>{tiles}</div>
    )

  if (board) {
    return (
      <div className={styles.boardPanel}>
        <Inline gap={12} align="stretch" className={styles.searchRow}>
          <div className={styles.searchField}>{field}</div>
          {tools}
        </Inline>

        {((suggestions && suggestions.length > 0) || onMore) && (
          <Inline gap={8}>
            {suggestions?.map((term) => (
              <Chip key={term} selected={term === value} onClick={() => onSubmit?.(term)}>
                {term}
              </Chip>
            ))}
            {onMore && (
              <Button variant="ghost" size="text" onClick={onMore}>
                <Icon name="shuffle" size={14} />
                Shuffle results
              </Button>
            )}
          </Inline>
        )}

        {/*
          The provider's mark.

          A requirement, not a flourish — every provider's terms ask for it
          "where the API is utilized", and it lives here rather than on each
          screen so the next board to be built cannot ship without it. It says
          nothing over the offline shelf, which is nobody's to claim; the
          `message` line below already explains that case.

          It used to share this line with the round's search counter. The
          budget is gone (ADR-0026) and the mark kept the row.
        */}
        {provider && (
          <Inline gap={10} justify="between" className={styles.meta}>
            <span className={styles.via}>{provider.attribution}</span>
          </Inline>
        )}

        {message && shown.length > 0 && <p className={styles.note}>{message}</p>}

        {/* Above the board, so it is seen — and outside the grid, so it is
            never mistaken for something pickable. Absent when no ad came. */}
        {ads && <AdSlot ads={ads} />}

        {grid}
      </div>
    )
  }

  return (
    <div className={styles.panel} role="dialog" aria-label="Attach a GIF">
      <div className={styles.head}>
        <span className={styles.title}>Attach a GIF</span>
        {/* Same rule as the board's mark: never over the offline shelf. */}
        {provider && <span className={styles.via}>{provider.attributionCompact}</span>}
        {onClose && (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close GIF panel"
          >
            <Icon name="close" size={13} />
          </button>
        )}
      </div>

      {field}
      {onMore && (
        <div className={styles.popoverTools}>
          <Button variant="ghost" size="text" onClick={onMore}>
            <Icon name="shuffle" size={13} />
            Shuffle results
          </Button>
        </div>
      )}
      {message && <p className={styles.note}>{message}</p>}
      {grid}
    </div>
  )
}
