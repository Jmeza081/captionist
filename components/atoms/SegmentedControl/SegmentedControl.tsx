'use client'

import type { ReactNode } from 'react'
import styles from './SegmentedControl.module.scss'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Optional leading glyph. Specified by the design; no surface uses it today. */
  icon?: ReactNode
  /** A green dot marking the room's actual mode in the help modal. */
  marked?: boolean
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive tech, e.g. "Game mode". */
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** `card` is the darker track used when the control sits on a card. */
  surface?: 'default' | 'card'
}

/**
 * A small, mutually exclusive choice — game mode, caption format, voting.
 *
 * A real radiogroup, so arrow keys move between options and the selection is
 * announced. Two options that aren't exclusive want checkboxes instead.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  surface = 'default',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`${styles.track} ${styles[surface]}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={`${styles.item} ${selected ? styles.active : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
            {option.marked && <span className={styles.marker} aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
