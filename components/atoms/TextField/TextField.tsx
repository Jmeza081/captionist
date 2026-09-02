'use client'

import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import styles from './TextField.module.scss'

/** The four heights the design draws, named for their job. */
export type TextFieldSize = 'caption' | 'search' | 'composer' | 'popover'

export interface TextFieldProps
  // `ComponentPropsWithRef` rather than `InputHTMLAttributes`, so `ref` reaches
  // the input like any other prop — React 19 passes it as one, and the front
  // doors need it to read what was typed before they hydrated. It rides in
  // `...rest` with everything else.
  extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  /** Sits above the field, uppercased. Omit for search and composer fields. */
  label?: string
  size?: TextFieldSize
  /**
   * The primary input on the screen carries the accent ring at rest — in this
   * app focus is the default state, not an exception.
   */
  primary?: boolean
  /** Shows "18 / 60" above right. Needs `maxLength` to render. */
  showCount?: boolean
  /** A leading glyph, typically the search magnifier. */
  icon?: ReactNode
  /** A trailing control inside the field — the composer's send key. */
  trailing?: ReactNode
  /**
   * What went wrong, in the domain's own words.
   *
   * A prop rather than a second component: `CodeEntry` and `QuickJoin` both
   * carry one already, and a nickname field that needs "Someone already has
   * that name" is the same job. The sentence comes from `authorize.ts`, so the
   * field states the room's reason rather than inventing its own.
   */
  error?: string
}

/**
 * Every text input in the app: captions, search, the chat composer.
 *
 * The counter is advisory, not a gate — `maxLength` does the enforcing, and
 * the count is there so nobody is surprised by it.
 */
export function TextField({
  label,
  size = 'search',
  primary = false,
  showCount = false,
  icon,
  trailing,
  error,
  className,
  value,
  maxLength,
  id,
  ...rest
}: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const length = typeof value === 'string' ? value.length : 0

  const errorId = `${fieldId}-error`

  const wrapClasses = [
    styles.field,
    styles[size],
    trailing ? styles.hasTrailing : '',
    primary ? styles.primary : '',
    error ? styles.invalid : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.wrap}>
      {(label || (showCount && maxLength)) && (
        <div className={styles.head}>
          {label && (
            <label className={styles.label} htmlFor={fieldId}>
              {label}
            </label>
          )}
          {showCount && maxLength && (
            <span className={styles.count}>
              {length} / {maxLength}
            </span>
          )}
        </div>
      )}

      <div className={wrapClasses}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input
          id={fieldId}
          className={styles.input}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        {trailing}
      </div>

      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
