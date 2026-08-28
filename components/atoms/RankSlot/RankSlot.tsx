'use client'

import type { ButtonHTMLAttributes } from 'react'
import styles from './RankSlot.module.scss'

export interface RankSlotProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "1st", "2nd", "3rd" — the place this slot holds. */
  ordinal: string
  /** What is in it. Absent means empty, and the slot draws a dashed outline. */
  entry?: string
  /** First place takes the winner tint, matching the vote card's gold ring. */
  first?: boolean
}

/**
 * One place in a ranked ballot.
 *
 * Not a `Chip` — a chip is a filter that reports `aria-pressed`, and this is a
 * slot you clear. Not a `Tag` — a tag is static. The design names "Rank slot"
 * as its own thing, and it has three states a chip has no room for: empty
 * (dashed), filled, and filled-at-first (gold).
 *
 * An empty slot is still a real button so the row's tab order does not change
 * as picks land; it just has nothing to clear yet.
 */
export function RankSlot({
  ordinal,
  entry,
  first = false,
  type = 'button',
  className,
  ...rest
}: RankSlotProps) {
  const filled = entry !== undefined && entry.length > 0
  const classes = [
    styles.slot,
    filled ? styles.filled : styles.empty,
    filled && first ? styles.first : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      // The label carries the state, because the tint and the dash are colour
      // and shape — neither reaches a screen reader. Action first, and no
      // punctuation of our own after the entry: a caption ends in a full stop
      // about half the time, and "Ship it.. Clear this pick" is what that got.
      aria-label={filled ? `Clear ${ordinal}: ${entry}` : `${ordinal}, empty`}
      {...rest}
    >
      <span className={styles.ordinal} aria-hidden="true">
        {ordinal}
      </span>
      {filled && (
        <span className={styles.entry} aria-hidden="true">
          {entry}
        </span>
      )}
    </button>
  )
}
