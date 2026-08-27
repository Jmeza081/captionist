'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@/components/atoms/Icon'
import { TextField } from '@/components/atoms/TextField'
import styles from './GifPanel.module.scss'

export interface GifResult {
  id: string
  src: string
  alt: string
  keywords: string[]
}

export interface GifPanelProps {
  results: GifResult[]
  /** Attaches and closes. It never sends on its own. */
  onPick: (gif: GifResult) => void
  onClose: () => void
  /** The one currently staged on the composer. */
  selectedId?: string
}

/**
 * Giphy search, opening above the composer inside the rail.
 *
 * Picking attaches the GIF to the composer and closes the panel — sending
 * stays a separate, deliberate act.
 */
export function GifPanel({
  results,
  onPick,
  onClose,
  selectedId,
}: GifPanelProps) {
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return results
    return results.filter((r) =>
      r.keywords.some((k) => k.toLowerCase().includes(q)),
    )
  }, [query, results])

  return (
    <div className={styles.panel} role="dialog" aria-label="Attach a GIF">
      <div className={styles.head}>
        <span className={styles.title}>Attach a GIF</span>
        <span className={styles.via}>via Giphy</span>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close GIF panel"
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      <TextField
        size="popover"
        placeholder="Search Giphy…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        icon={<Icon name="search" size={13} />}
        aria-label="Search Giphy"
      />

      {shown.length === 0 ? (
        <p className={styles.empty}>
          No GIFs for &ldquo;{query}&rdquo;. Try a shorter word.
        </p>
      ) : (
        <div className={styles.grid}>
          {shown.map((gif) => (
            <button
              key={gif.id}
              type="button"
              className={`${styles.tile} ${gif.id === selectedId ? styles.selected : ''}`}
              onClick={() => onPick(gif)}
              aria-label={`Attach ${gif.alt}`}
              aria-pressed={gif.id === selectedId}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gif.src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
