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
  /**
   * The setting does not apply right now.
   *
   * Not `disabled`, and deliberately not `aria-disabled` either: `Button`'s
   * `blocked` is a tint and nothing else, and `e2e/landing.spec.ts` asserts a
   * blocked control is `not.toBeDisabled()` — which `aria-disabled` would
   * falsify. One meaning for the word across the app is worth more than a
   * second signal on one atom, and what a held-back control owes a reader is
   * the *reason*, which is adjacent text. The host toolbox is the case: a
   * round timer in a lobby is a clock reading 0:00 with two keys that adjust
   * nothing, and one line under the group says so.
   */
  blocked?: boolean
}

/**
 * A bounded numeric setting — the round timer, the round count.
 *
 * Renders as a spinbutton so the value and its bounds are announced together,
 * and the keys disable at the ends rather than silently no-opping.
 *
 * `blocked` is the other kind of unavailable — the setting itself does not
 * apply — and it is held back rather than disabled, which is the whole of
 * `CLAUDE.md` rule 10.
 */
export function Stepper({
  label,
  value,
  format,
  onChange,
  step = 1,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  blocked = false,
}: StepperProps) {
  // Generated, not derived from `label` — a label with spaces would produce an
  // id with spaces, and aria-labelledby splits on whitespace.
  const labelId = useId()

  const atMin = value - step < min
  const atMax = value + step > max

  return (
    <div className={`${styles.row} ${blocked ? styles.blocked : ''}`}>
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
