'use client'

import { useId } from 'react'
import styles from './Stepper.module.scss'

export interface StepperProps {
  /** What's being stepped, e.g. "Submission time limit". */
  label: string
  value: number
  /** How the value reads — `(90) => '90 sec'`. */
  format: (value: number) => string
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
}

/**
 * A bounded numeric setting — the round timer, the round count.
 *
 * Renders as a spinbutton so the value and its bounds are announced together,
 * and the keys disable at the ends rather than silently no-opping.
 */
export function Stepper({
  label,
  value,
  format,
  onChange,
  step = 1,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
}: StepperProps) {
  // Generated, not derived from `label` — a label with spaces would produce an
  // id with spaces, and aria-labelledby splits on whitespace.
  const labelId = useId()

  const atMin = value - step < min
  const atMax = value + step > max

  return (
    <div className={styles.row}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      <div className={styles.control}>
        <button
          type="button"
          className={styles.key}
          onClick={() => onChange(value - step)}
          disabled={atMin}
          aria-label={`Decrease ${label}`}
        >
          &minus;
        </button>
        <span
          className={styles.value}
          role="spinbutton"
          tabIndex={0}
          aria-valuenow={value}
          aria-valuemin={min === Number.NEGATIVE_INFINITY ? undefined : min}
          aria-valuemax={max === Number.POSITIVE_INFINITY ? undefined : max}
          aria-valuetext={format(value)}
          aria-labelledby={labelId}
        >
          {format(value)}
        </span>
        <button
          type="button"
          className={styles.key}
          onClick={() => onChange(value + step)}
          disabled={atMax}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}
