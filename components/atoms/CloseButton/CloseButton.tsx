import { Icon } from '@/components/atoms/Icon'
import styles from './CloseButton.module.scss'

/** The two sizes the app dismisses things at. */
export type CloseButtonSize = 'medium' | 'small'

export interface CloseButtonProps {
  onClick: () => void
  /**
   * Names what is being closed — "Close chat", "Stop replying".
   *
   * Required, and there is no fallback to a bare "Close": five surfaces use
   * this and a screen reader that meets three of them wants to know which
   * three.
   */
  label: string
  /**
   * `medium` is a header's key — a modal, the chat sheet, the toolbox.
   * `small` is one inside a row that is already tight: a staged attachment, a
   * popover's title bar.
   */
  size?: CloseButtonSize
  /** For a host that has to place it — a grid area, a negative inset. */
  className?: string
}

/** The glyph, and the weight it is drawn at, per size. */
const GLYPH: Record<CloseButtonSize, { size: number; weight: number }> = {
  // Heavier than the 2.2 `close` carries on its own. A mark on a plate has to
  // hold its own against the plate, and at 16px the design's own weight read
  // as a hairline scratch rather than a control.
  medium: { size: 15, weight: 2.8 },
  small: { size: 12, weight: 2.6 },
}

/**
 * The one way out of anything — a filled disc with a × on it.
 *
 * Five surfaces drew their own before this existed: the modal, the chat sheet,
 * the room toolbox, the GIF popover and the composer's two staged rows. Every
 * one of them was a bare 2.2pt × on nothing, which is the least affordance a
 * control can have — nothing about it says it is pressable until you are
 * already on it, and on a phone there is no hover to find out with.
 *
 * So the disc *is* the affordance and the size prop is the only variation:
 * `medium` fills the 44px target it already had, `small` is a 26px key for a
 * row that never had 44 to give. Neither is a new drawing — both are `close`
 * at a weight the plate can carry.
 */
export function CloseButton({ onClick, label, size = 'medium', className }: CloseButtonProps) {
  const glyph = GLYPH[size]

  return (
    <button
      type="button"
      className={`${styles.key} ${styles[size]} ${className ?? ''}`}
      onClick={onClick}
      aria-label={label}
    >
      <Icon name="close" size={glyph.size} weight={glyph.weight} />
    </button>
  )
}
