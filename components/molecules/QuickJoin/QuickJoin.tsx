'use client'

import { useId, useRef } from 'react'
import { Button } from '@/components/atoms/Button'
import styles from './QuickJoin.module.scss'

/**
 * The landing page's one-line way into a room.
 *
 * Deliberately **not** `CodeEntry`, which is the `/join` route's control. They
 * look different because they do different jobs:
 *
 * - `CodeEntry` is the whole screen for someone who arrived to join. Seven
 *   thumb-sized slots, one per character, sized for a phone held in one hand
 *   while a host reads the code aloud.
 * - This is a glance-and-go field sitting beside a headline, on frosted glass,
 *   over moving media. It has to stay small enough not to compete with the
 *   primary action next to it, and legible against whatever is playing behind.
 *
 * A `size` prop on one component would have to change its shape, its density,
 * its surface and its ceremony at once — which is two components wearing one
 * name. What they do share is the rule that the `C-` prefix is never typed.
 *
 * Structurally it borrows `CodeEntry`'s one trick: a single real input behind
 * a presentational mask. Six inputs would mean six focus stops, broken paste,
 * and a screen reader announcing "edit, blank" six times.
 */
export interface QuickJoinProps {
  /** What's been typed so far, without the `C-` prefix. */
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  /** The action's label. Says what's missing when `blocked`. */
  actionLabel?: string
  /** Not enough code yet — the key stays live and the label says so. */
  blocked?: boolean
  /** Says what happened and what to do next. */
  error?: string
}

/** Room codes are `C-` plus six characters. */
const PREFIX = 'C-'
const LENGTH = 6

export function QuickJoin({
  value,
  onChange,
  onSubmit,
  actionLabel = 'Join',
  blocked = false,
  error,
}: QuickJoinProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const errorId = `${id}-error`

  // The design's `C-______`: what is typed, then a rail of underscores for
  // what is not. Fixed width either way, so the pill never resizes as you go.
  const typed = value.slice(0, LENGTH)
  const mask = typed.padEnd(LENGTH, '_')

  return (
    <form
      className={styles.pill}
      onSubmit={(e) => {
        e.preventDefault()
        if (!blocked) onSubmit()
      }}
    >
      <span className={styles.field} onClick={() => inputRef.current?.focus()}>
        <span className={styles.mask} aria-hidden="true">
          {PREFIX}
          <span className={styles.typed}>{typed}</span>
          <span className={styles.rest}>{mask.slice(typed.length)}</span>
        </span>

        <input
          ref={inputRef}
          className={styles.input}
          value={typed}
          onChange={(e) =>
            onChange(
              e.target.value
                .toUpperCase()
                .replace(/[^0-9A-Z]/g, '')
                .slice(0, LENGTH),
            )
          }
          aria-label="Room code"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={LENGTH}
        />
      </span>

      <Button type="submit" variant="secondary" size="small" blocked={blocked}>
        {actionLabel}
      </Button>

      {error && (
        <span id={errorId} role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </form>
  )
}
