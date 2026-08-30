'use client'

import { useId, useRef, useState } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { Button } from '@/components/atoms/Button'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { AVATAR_SEEDS, AVATAR_WINDOW, avatarPage, previewColor, seedLabel } from '@/lib/avatar'
import styles from './AvatarPicker.module.scss'

export interface AvatarPickerProps {
  /** The seed currently chosen. */
  value: string
  onChange: (seed: string) => void
  /** Sits above the row, uppercased — "Pick your face". */
  label: string
  /**
   * The catalogue the window is drawn *from* — not the faces shown. Defaults
   * to the app's seventy.
   */
  seeds?: readonly string[]
}

/**
 * Choosing a face, on `/join` and on `/host`.
 *
 * A molecule rather than a mapped row in each screen because of the mapping,
 * not the markup: a seed's position decides the colour it previews on, and two
 * hand-rolled copies of that would drift the first time the palette changes.
 *
 * **Ten at a time, out of seventy.** Showing all of them would be seven rows
 * of faces above the field somebody came here to fill in. So the picker offers
 * a window and a way to change it, which is also the honest shape of the
 * choice: nobody compares seventy procedurally generated creatures, they flick
 * through until one is theirs. Ten rather than eight because eight was one
 * short of a room — a full lobby is twenty and the offer should not be the
 * thing that makes two people pick the same face.
 *
 * **The colour is a preview, not a promise.** `player/joined` assigns a seat
 * colour from join order, because a colour has to be unique-ish across a room
 * and only the room can know that. What you pick here is the face.
 */
export function AvatarPicker({ value, onChange, label, seeds = AVATAR_SEEDS }: AvatarPickerProps) {
  const labelId = useId()
  // `null` until somebody shuffles, so the first render is derived purely from
  // `value` and the server and the browser agree. See `avatarPage`.
  const [shuffled, setShuffled] = useState<readonly string[] | null>(null)
  const tiles = useRef<(HTMLButtonElement | null)[]>([])

  const offered = shuffled ?? avatarPage(value, seeds)
  // Your own face is never shuffled out from under you. It also covers the
  // stored-seed-not-in-the-catalogue case, where the page is a fallback.
  const shown = offered.includes(value)
    ? offered
    : [value, ...offered.filter((seed) => seed !== value)].slice(0, AVATAR_WINDOW)

  function shuffle() {
    // Reinserted where it already sat, rather than at the front: the ring stays
    // put while everything around it changes, and `previewColor` is indexed by
    // position, so pinning the position keeps your own preview colour still.
    const at = Math.max(shown.indexOf(value), 0)
    const pool = seeds.filter((seed) => seed !== value)
    const drawn: string[] = []
    while (drawn.length < AVATAR_WINDOW - 1 && drawn.length < pool.length) {
      const candidate = pool[Math.floor(Math.random() * pool.length)]
      if (candidate && !drawn.includes(candidate)) drawn.push(candidate)
    }
    drawn.splice(at, 0, value)
    setShuffled(drawn)
  }

  /** Arrow keys move through a radiogroup and take the selection with them. */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    const jump = event.key === 'Home' ? 0 : event.key === 'End' ? shown.length - 1 : undefined

    if (step === 0 && jump === undefined) return
    event.preventDefault()

    const from = Math.max(shown.indexOf(value), 0)
    const to = jump ?? (from + step + shown.length) % shown.length
    const next = shown[to]
    if (!next) return
    onChange(next)
    tiles.current[to]?.focus()
  }

  return (
    <Stack gap={12} className={styles.picker}>
      <Inline gap={10} justify="between" align="center">
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {/* Says what it does rather than relying on an `aria-label` the visible
            text would then have to contain. `text` rather than the default
            size because it ends the row: the pill's horizontal padding would
            inset the label from the edge the field below is flush with.

            The glyph is decorative — the label already says "Shuffle faces" —
            and it is there because this is the one control on the row that
            does something rather than selecting something. */}
        <Button variant="ghost" size="text" onClick={shuffle}>
          <Icon name="shuffle" size={14} />
          Shuffle faces
        </Button>
      </Inline>

      {/* A real radiogroup. The buttons have carried `role="radio"` since they
          were written, but without this they were radios with no group. */}
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={styles.row}
        onKeyDown={onKeyDown}
      >
        {shown.map((seed, i) => {
          const chosen = seed === value
          return (
            <button
              key={seed}
              type="button"
              ref={(el) => {
                tiles.current[i] = el
              }}
              className={styles.face}
              role="radio"
              aria-checked={chosen}
              aria-label={seedLabel(seed)}
              // Roving tabindex: the group is one tab stop, and the arrow keys
              // above are what move within it. Without those this would be a
              // trap, which is why the two ship together — and it is safe to
              // hang the only stop on `chosen` because `shown` is built to
              // always contain `value`, so exactly one tile is ever chosen.
              tabIndex={chosen ? 0 : -1}
              onClick={() => onChange(seed)}
            >
              <Avatar
                name={seedLabel(seed)}
                color={previewColor(i)}
                avatarSeed={seed}
                size={46}
                selected={chosen}
                dimmed={!chosen}
                decorative
              />
            </button>
          )
        })}
      </div>
    </Stack>
  )
}
