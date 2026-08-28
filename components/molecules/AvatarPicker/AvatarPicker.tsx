'use client'

import { Avatar } from '@/components/atoms/Avatar'
import { AVATAR_SEEDS, previewColor } from '@/lib/avatar'
import styles from './AvatarPicker.module.scss'

export interface AvatarPickerProps {
  /** The seed currently chosen. */
  value: string
  onChange: (seed: string) => void
  /** Sits above the row, uppercased — "Pick your face". */
  label: string
  /** The seeds on offer. Defaults to the app's seven. */
  seeds?: readonly string[]
}

/**
 * Choosing a face, on `/join` and on `/host`.
 *
 * A molecule rather than a mapped row in each screen because of the mapping,
 * not the markup: a seed's position decides the colour it previews on, and two
 * hand-rolled copies of that would drift the first time the palette changes.
 *
 * **The colour is a preview, not a promise.** `player/joined` assigns a seat
 * colour from join order, because a colour has to be unique-ish across a room
 * and only the room can know that. What you pick here is the face.
 */
export function AvatarPicker({ value, onChange, label, seeds = AVATAR_SEEDS }: AvatarPickerProps) {
  return (
    <fieldset className={styles.picker}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.row}>
        {seeds.map((seed, i) => {
          const chosen = seed === value
          return (
            <button
              key={seed}
              type="button"
              className={styles.face}
              // A radio group in behaviour, so state goes to assistive tech
              // rather than being carried by the ring alone.
              role="radio"
              aria-checked={chosen}
              aria-label={`Face ${i + 1}`}
              onClick={() => onChange(seed)}
            >
              <Avatar
                name={`Face ${i + 1}`}
                color={previewColor(i)}
                avatarSeed={seed}
                size={46}
                selected={chosen}
                dimmed={!chosen}
              />
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
