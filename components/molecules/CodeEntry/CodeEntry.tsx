'use client'

import { useId, useRef } from 'react'
import styles from './CodeEntry.module.scss'

export interface CodeEntryProps {
  /** What's been typed so far, without the `C-` prefix. */
  value: string
  onChange: (value: string) => void
  /** Fires when the code reaches full length. */
  onComplete?: (code: string) => void
  /** Something went wrong — says what happened and what to do next. */
  error?: string
  /** `lg` is the landing screen; the default fits a narrower column. */
  size?: 'md' | 'lg'
}

/** Room codes are `C-` plus six characters. */
const PREFIX = 'C-'
const LENGTH = 6

/**
 * Typing a room code by hand.
 *
 * One real input behind the slots rather than six — six inputs means six
 * focus targets, broken paste, and a screen reader announcing "edit, blank"
 * six times. The slots are presentation; the input is the control.
 */
export function CodeEntry({
  value,
  onChange,
  onComplete,
  error,
  size = 'md',
}: CodeEntryProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const errorId = `${id}-error`

  const chars = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('')
  const activeIndex = Math.min(value.length, LENGTH - 1)

  function handle(next: string) {
    const cleaned = next
      .toUpperCase()
      .replace(/^C-/, '')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, LENGTH)

    onChange(cleaned)
    if (cleaned.length === LENGTH) onComplete?.(PREFIX + cleaned)
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        id={id}
        className={styles.input}
        value={value}
        onChange={(e) => handle(e.target.value)}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        spellCheck={false}
        maxLength={LENGTH}
        aria-label="Room code"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />

      <div
        className={`${styles.slots} ${styles[size]}`}
        data-testid="code-slots"
        onClick={() => inputRef.current?.focus()}
        aria-hidden="true"
      >
        <span className={`${styles.slot} ${styles.prefix}`}>C</span>

        {chars.map((char, i) => (
          <span
            key={i}
            className={[
              styles.slot,
              char.trim() ? styles.filled : '',
              i === activeIndex && value.length < LENGTH ? styles.active : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {char.trim() || ''}
          </span>
        ))}
      </div>

      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
