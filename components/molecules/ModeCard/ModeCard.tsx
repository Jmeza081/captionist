'use client'

import type { ReactNode } from 'react'
import { Tag } from '@/components/atoms/Tag'
import styles from './ModeCard.module.scss'

export interface ModeCardProps {
  title: string
  body: string
  /** `Classic` / `Reversed` until picked, then `Selected`. */
  tag: string
  selected: boolean
  onSelect: () => void
  icon?: ReactNode
}

/**
 * One of the two game modes, on the host's setup screen.
 *
 * Not a `SegmentedControl`: that is a pill row for a compact either/or, and
 * this is a card carrying a title, a sentence explaining who supplies what, and
 * a state tag. Growing the segmented control a card variant would hand every
 * other caller — the mode toggle in the lobby, caption format, voting — three
 * props they never set.
 *
 * The design's reason for the shape is worth keeping: a host picks *a format*,
 * not a setting, so the card has to say what the format means.
 */
export function ModeCard({ title, body, tag, selected, onSelect, icon }: ModeCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.title}>{title}</span>
      <span className={styles.body}>{body}</span>
      <Tag tone={selected ? 'accent' : 'neutral'}>{tag}</Tag>
    </button>
  )
}
