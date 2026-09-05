'use client'

import { Button } from '@/components/atoms/Button'
import { Icon } from '@/components/atoms/Icon'
import type { Progress } from '@/lib/export/types'
import styles from './ExportKey.module.scss'

export interface ExportKeyProps {
  /**
   * What the key says. Decided by `useExport`: the device's word when idle
   * ("Share GIF", "Copy image"), the count while rendering ("Rendering 12 of
   * 60…"), and "Send GIF" for a file waiting on a second tap.
   */
  label: string
  /** This key is the one rendering. The control stays live — rule 10. */
  busy?: boolean
  progress?: Progress
  onClick: () => void
  /**
   * `label` is a secondary `Button` for a screen with room — the reveal, the
   * score, the podium. `glyph` is the 32px pill a card foot draws its
   * controls at, for the vote grid, where the label becomes the accessible
   * name and the count replaces the glyph while it runs.
   */
  appearance?: 'label' | 'glyph'
  /** The `label` form's button size: `small` beside a card, `form` in a row of form keys. */
  size?: 'small' | 'form'
  className?: string
}

/**
 * The one key that takes something out of the room.
 *
 * New rather than a `Button` variant because a button's label is its text,
 * and this one's is sometimes a glyph, sometimes a fraction, and always a
 * different word on a different device; and not `ReactionCTA`, which is the
 * smiley by rule. It composes `Button` and `Icon`, so it is a molecule.
 *
 * Progress is announced at the ends and the middle, not every frame: a
 * live region that changes sixty times in three seconds is a screen reader
 * reading numbers over the person trying to use it.
 */
export function ExportKey({
  label,
  busy = false,
  progress,
  onClick,
  appearance = 'label',
  size = 'small',
  className,
}: ExportKeyProps) {
  const announce = busy && progress ? milestone(progress) : busy ? 'Rendering' : undefined

  if (appearance === 'glyph') {
    const fraction = busy && progress && progress.total > 1 ? `${progress.done}/${progress.total}` : undefined
    return (
      <button
        type="button"
        className={[styles.pill, busy ? styles.busy : '', className ?? ''].filter(Boolean).join(' ')}
        onClick={onClick}
        aria-label={label}
        aria-busy={busy || undefined}
      >
        {fraction ? <span className={styles.fraction}>{fraction}</span> : <Icon name="share" size={14} />}
        {announce && (
          <span role="status" className={styles.srOnly}>
            {announce}
          </span>
        )}
      </button>
    )
  }

  return (
    <span className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')}>
      <Button variant="secondary" size={size} blocked={busy} onClick={onClick} aria-busy={busy || undefined}>
        {label}
      </Button>
      {announce && (
        <span role="status" className={styles.srOnly}>
          {announce}
        </span>
      )}
    </span>
  )
}

/** The three moments worth saying out loud. */
function milestone({ done, total }: Progress): string | undefined {
  if (total <= 1) return 'Rendering'
  if (done === 0) return 'Rendering'
  if (done === total) return 'Rendered'
  if (done === Math.floor(total / 2)) return 'Halfway'
  return undefined
}
