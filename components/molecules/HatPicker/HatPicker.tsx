'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import type { HatId } from '@/lib/game/types'
import { hatArt, HAT_IDS, HAT_LABELS, HAT_WINDOW } from '@/lib/hats'
import styles from './HatPicker.module.scss'

export interface HatPickerProps {
  /** The hat worn, or `undefined` for bare-headed. */
  value: HatId | undefined
  onChange: (hat: HatId | undefined) => void
  /** Sits above the grid, uppercased — "Host hat". */
  label: string
  /** The line under it, explaining what a hat is for. */
  body: string
  /**
   * Draws the label as a section heading rather than a field label.
   *
   * `/host` gives the hat a section of its own, beside "Host info" and "Game
   * mode"; `/join`'s card has no headings at all and folds it in with the face
   * and the nickname, which is one question — who is asking for the seat.
   */
  heading?: boolean
}

/**
 * Choosing a hat, on `/join` and on `/host`.
 *
 * Built to `AvatarPicker`'s shape rather than beside it, because they are the
 * same control twice: a real `role="radiogroup"` with a roving tabindex, one
 * tab stop, and arrow keys that move the selection with the focus. What is
 * different is only what a tile draws and how many there are.
 *
 * **It arrives folded.** `AvatarPicker`'s docblock is emphatic that ten faces
 * was already "seven rows of faces above the field somebody came here to fill
 * in", and this is the *second* picker on that card. So six are offered and
 * the rest are a click away — see `HAT_WINDOW`.
 *
 * **Bare-headed is a tile, not an absence.** "No hat" is the first thing in
 * the group, so clearing a hat is the same gesture as choosing one and the
 * roving tabindex has something to land on when nothing is worn.
 */
export function HatPicker({ value, onChange, label, body, heading = false }: HatPickerProps) {
  const labelId = useId()
  const gridId = useId()
  const [open, setOpen] = useState(false)
  const tiles = useRef<(HTMLButtonElement | null)[]>([])

  /**
   * `undefined` first, then the catalogue — folded to `HAT_WINDOW` until it is
   * opened, and always containing what is worn.
   *
   * The last clause is what makes the single tab stop safe, and it is the same
   * invariant `AvatarPicker` keeps: a hat picked from the open grid must not
   * vanish when the grid folds, or the group would have no tile to focus.
   */
  const shown = useMemo<readonly (HatId | undefined)[]>(() => {
    if (open) return [undefined, ...HAT_IDS]
    const folded = HAT_IDS.slice(0, HAT_WINDOW)
    const worn = value && !folded.includes(value) ? [value] : []
    return [undefined, ...worn, ...folded]
  }, [open, value])

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
    onChange(shown[to])
    tiles.current[to]?.focus()
  }

  return (
    <Stack gap={12} className={styles.picker}>
      <Inline gap={10} justify="between" align="center">
        {heading ? (
          <h2 id={labelId} className={styles.heading}>
            {label}
          </h2>
        ) : (
          <span id={labelId} className={styles.label}>
            {label}
          </span>
        )}
        {/* What you are wearing, named. Not a control — the row's right-hand
            slot is a label here where `AvatarPicker` puts its shuffle, because
            a hat has a name worth reading and a face does not. */}
        <span className={styles.worn}>{value ? HAT_LABELS[value] : 'No hat'}</span>
      </Inline>

      <p className={styles.body}>{body}</p>

      <div
        id={gridId}
        role="radiogroup"
        aria-labelledby={labelId}
        className={styles.grid}
        onKeyDown={onKeyDown}
      >
        {shown.map((hat, i) => {
          const chosen = hat === value
          const art = hatArt(hat)
          return (
            <button
              key={hat ?? 'none'}
              type="button"
              ref={(el) => {
                tiles.current[i] = el
              }}
              className={`${styles.tile} ${chosen ? styles.chosen : ''}`}
              role="radio"
              aria-checked={chosen}
              aria-label={hat ? HAT_LABELS[hat] : 'No hat'}
              // Roving tabindex, on the same terms as `AvatarPicker`: one tab
              // stop, arrows within, and safe to hang on `chosen` only because
              // `shown` is built to always contain `value`.
              tabIndex={chosen ? 0 : -1}
              onClick={() => onChange(hat)}
            >
              {art ? (
                // Decorative: the button is already labelled with the hat's
                // name, and the art inside it would be the same thing twice.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={art} alt="" aria-hidden="true" className={styles.art} />
              ) : (
                <span className={styles.bare} aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      {/* The disclosure. `chevronRight` rotated, because there is no
          `chevronDown` in the sprite and `ChatRail` already turns this one. */}
      <Button
        variant="ghost"
        size="text"
        aria-expanded={open}
        aria-controls={gridId}
        onClick={() => setOpen((was) => !was)}
      >
        <span className={`${styles.chevron} ${open ? styles.up : ''}`}>
          <Icon name="chevronRight" size={14} />
        </span>
        {open ? 'Show fewer hats' : 'Show all hats'}
      </Button>
    </Stack>
  )
}
