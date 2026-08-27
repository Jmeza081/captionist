'use client'

import { useId, useRef, useState } from 'react'
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
  const [focused, setFocused] = useState(false)
  const id = useId()
  const errorId = `${id}-error`

  // The design's `C-______`: what is typed, then a rail of underscores for
  // what is not. Every character sits in a cell of its own fixed width —
  // Inter is proportional, so an `F` and an `_` are not the same size and the
  // pill would resize on every keypress otherwise.
  const typed = value.slice(0, LENGTH)
  const cells = Array.from({ length: LENGTH }, (_, i) => typed[i])
  // Which cell fills next. The native caret is hidden: it sits wherever the
  // transparent input's own text lands, which is nowhere near the mask.
  const caret = typed.length

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
          <span className={styles.prefix}>{PREFIX}</span>
          {cells.map((char, i) => (
            <span
              key={i}
              className={[
                styles.cell,
                char ? styles.filled : '',
                focused && i === caret ? styles.caret : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {char ?? '_'}
            </span>
          ))}
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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

      <Button
        type="submit"
        variant="secondary"
        size="small"
        blocked={blocked}
        className={styles.key}
      >
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
