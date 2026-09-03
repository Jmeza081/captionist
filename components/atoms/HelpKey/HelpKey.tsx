import { Icon } from '@/components/atoms/Icon'
import styles from './HelpKey.module.scss'

/**
 * Which neighbour the key is drawn to match — and the size is part of that,
 * because "matches its neighbour" is the whole reason there are two.
 */
export type HelpKeyTone = 'accent' | 'outline'

export interface HelpKeyProps {
  onClick: () => void
  /**
   * Overridable, but rarely worth it — this key opens the same walkthrough
   * everywhere, so the same name reads correctly on every surface.
   */
  label?: string
  /**
   * `accent` is the room's key: a 36px subtle plate with the glyph in accent
   * text, sized to the round × directly under it. `outline` is the landing
   * nav's: 44px with the outline button's hairline and hover fill, because it
   * sits in that button's row and a plate eight pixels shorter than the pill
   * beside it read as a decoration rather than a control.
   */
  tone?: HelpKeyTone
  /** For a host that has to place it — a nav slot, a grid area. */
  className?: string
}

/** The glyph size each plate can carry without the mark floating in it. */
const GLYPH: Record<HelpKeyTone, number> = {
  accent: 17,
  outline: 20,
}

/**
 * The round key that opens the walkthrough — a `?` on a disc.
 *
 * The lobby drew this inline first, as the one thing the app header's trailing
 * slot hangs on a screen with neither a clock nor rounds to report. The landing
 * nav then needed the same control for the opposite reason: it has the room for
 * "How it works" in words on a laptop and none on a phone, where the two text
 * links stand down and the walkthrough went with them.
 *
 * Both tones clear the 44px touch minimum, and only one of them draws it: the
 * nav's key *is* 44, matched to the pill it sits beside; the room's is a 36px
 * plate — `CloseButton.medium`'s size, because a phone puts those two round
 * keys in a column — with the target hung off it as an out-of-flow `::after`,
 * so the minimum is intact without widening the box its neighbours line up on.
 */
export function HelpKey({
  onClick,
  label = 'How Captionist works',
  tone = 'accent',
  className,
}: HelpKeyProps) {
  return (
    <button
      type="button"
      className={`${styles.key} ${styles[tone]} ${className ?? ''}`}
      onClick={onClick}
      aria-label={label}
    >
      <Icon name="help" size={GLYPH[tone]} />
    </button>
  )
}
