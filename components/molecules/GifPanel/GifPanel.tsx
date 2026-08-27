'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Chip } from '@/components/atoms/Chip'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { TextField } from '@/components/atoms/TextField'
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
  status?: 'loading' | 'ready' | 'error'
  /** Shown under the field — an error, or a note that these are samples. */
  message?: string
  /** Extra control beside the field. "Surprise me" lives here. */
  tools?: ReactNode
  /** The badge on the chosen tile: "Selected" when picking, "Your answer" when answering. */
  selectionLabel?: string
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
  status = 'ready',
  message,
  tools,
  selectionLabel = 'Selected',
}: GifPanelProps) {
  const [localQuery, setLocalQuery] = useState('')
  const controlled = query !== undefined
  const value = controlled ? query : localQuery

  const shown = useMemo(() => {
    // A server-backed search has already narrowed the page; filtering it again
    // locally would hide results that matched for reasons the title doesn't say.
    if (onSubmit) return results
    const q = localQuery.trim().toLowerCase()
    if (!q) return results
    return results.filter((r) => r.keywords.some((k) => k.toLowerCase().includes(q)))
  }, [localQuery, results, onSubmit])

  const board = variant === 'board'

  const field = (
    <TextField
      size={board ? 'search' : 'popover'}
      primary={board}
      placeholder={board ? 'deploy on friday' : 'Search Giphy…'}
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
      aria-label="Search Giphy"
    />
  )

  const grid =
    shown.length === 0 ? (
      <p className={styles.empty}>
        {status === 'error'
          ? (message ?? 'That search didn’t come back. Try again.')
          : status === 'loading'
            ? 'Looking…'
            : `No GIFs for “${value}”. Try a shorter word.`}
      </p>
    ) : (
      <div className={board ? styles.board : styles.grid}>
        {shown.map((gif) => (
          <button
            key={gif.id}
            type="button"
            className={`${styles.tile} ${gif.id === selectedId ? styles.selected : ''}`}
            onClick={() => onPick(gif)}
            aria-label={board ? `Pick ${gif.alt}` : `Attach ${gif.alt}`}
            aria-pressed={gif.id === selectedId}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gif.src} alt="" />
            {board && gif.id === selectedId && (
              <span className={styles.badge}>{selectionLabel}</span>
            )}
          </button>
        ))}
      </div>
    )

  if (board) {
    return (
      <div className={styles.boardPanel}>
        <Inline gap={12} align="stretch" className={styles.searchRow}>
          <div className={styles.searchField}>{field}</div>
          {tools}
        </Inline>

        {suggestions && suggestions.length > 0 && (
          <Inline gap={8}>
            {suggestions.map((term) => (
              <Chip
                key={term}
                selected={term === value}
                onClick={() => onSubmit?.(term)}
              >
                {term}
              </Chip>
            ))}
          </Inline>
        )}

        {message && shown.length > 0 && <p className={styles.note}>{message}</p>}

        {grid}
      </div>
    )
  }

  return (
    <div className={styles.panel} role="dialog" aria-label="Attach a GIF">
      <div className={styles.head}>
        <span className={styles.title}>Attach a GIF</span>
        <span className={styles.via}>via Giphy</span>
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
      {grid}
    </div>
  )
}
