'use client'

import { useId } from 'react'
import styles from './Toggle.module.scss'

export interface ToggleProps {
  /** The setting this switches, e.g. "Enforce unique nicknames". */
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * A room setting, on or off.
 *
 * Controlled: it owns no state, so the host toolbox and the setup screen can
 * both drive it from wherever the setting actually lives.
 */
export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  const id = useId()

  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`${styles.toggle} ${checked ? styles.on : ''}`}
      >
        <span className={styles.track} />
        <span className={styles.knob} />
      </button>
    </div>
  )
}
