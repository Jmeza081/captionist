import { isImageGlyph } from '@/lib/reactions'
import styles from './ReactionGlyph.module.scss'

export interface ReactionGlyphProps {
  /** An emoji character, or the URL of an image tile. */
  glyph: string
  /** Matches the type size it sits beside. */
  size?: number
}

/**
 * One reaction's face — a character or a picture, from a single glyph string.
 *
 * An atom rather than a ternary, because the wire carries the *glyph* and three
 * places render it: the vote grid's tallies, the reveal's, and chat's. Once
 * `REACTIONS` gained image tiles, every one of them would otherwise have grown
 * the same branch — and the day one of them forgot, a tally would print a URL
 * as text. Which is exactly what all three did before this existed.
 *
 * Decorative on purpose: `TallyPill` already hides its glyph from screen
 * readers and carries the reaction's name in its own visually-hidden label.
 */
export function ReactionGlyph({ glyph, size = 14 }: ReactionGlyphProps) {
  if (!isImageGlyph(glyph)) return <>{glyph}</>

  // The app's own animated SVG — next/image would rasterise it.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={glyph}
      alt=""
      width={size}
      height={size}
      className={styles.image}
      loading="lazy"
      decoding="async"
    />
  )
}
