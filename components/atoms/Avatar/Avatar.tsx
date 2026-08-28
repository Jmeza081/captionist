import { avatarUri } from '@/lib/avatar'
import styles from './Avatar.module.scss'

/** The eight sizes the design specifies, in px. */
export const AVATAR_SIZES = [26, 30, 34, 40, 46, 56, 88, 108] as const
export type AvatarSize = (typeof AVATAR_SIZES)[number]

export interface AvatarProps {
  /** Player name. Drives the initial and the accessible label. */
  name: string
  /** The player's colour — the circle behind the art. */
  color: string
  /** Avatar art, when something has already resolved it. */
  src?: string
  /**
   * Dicebear input. Rendered into a face locally, because the seed is what
   * travels in `GameState` and the art must never be what goes on the wire.
   * `src` wins if both are given; the initial is the fallback for neither.
   *
   * Named for the field it comes from, so `<Avatar {...player} />` keeps
   * working — every molecule spreads a player straight in.
   */
  avatarSeed?: string
  size?: AvatarSize
  /** Chosen in setup: gains a 2px accent ring. */
  selected?: boolean
  /** Not chosen, or not yet acted: drops to 55%. */
  dimmed?: boolean
  /**
   * Drops out of the accessibility tree entirely.
   *
   * For when a parent already names this player — the picker's face buttons
   * are labelled with the seed, and a labelled `role="img"` inside a labelled
   * button is the same player announced twice.
   */
  decorative?: boolean
}

/**
 * A player, as a colour-filled circle with their art inset to ~78%.
 *
 * Three ways to fill it, in order: a resolved `src`, a `seed` rendered into a
 * face, or the player's initial. The initial is not a placeholder to be
 * replaced later — it is what a room falls back to when a seed is absent, and
 * on the player's own colour it still identifies them.
 */
export function Avatar({
  name,
  color,
  src,
  avatarSeed,
  size = 40,
  selected = false,
  dimmed = false,
  decorative = false,
}: AvatarProps) {
  const classes = [
    styles.avatar,
    selected ? styles.selected : '',
    dimmed ? styles.dimmed : '',
  ]
    .filter(Boolean)
    .join(' ')

  // The design insets the art to ~78% of the circle.
  const art = Math.round(size * 0.78)
  const image = src ?? (avatarSeed ? avatarUri(avatarSeed) : undefined)

  return (
    <span
      className={classes}
      style={{ width: size, height: size, backgroundColor: color }}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': selected ? `${name}, selected` : name })}
    >
      {image ? (
        // Avatar art is a fixed-size sprite, not a responsive image, so
        // next/image would add a loader round-trip for nothing.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={art} height={art} className={styles.art} />
      ) : (
        <span className={styles.initial} style={{ fontSize: art * 0.44 }}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}

export interface AvatarOverflowProps {
  /** How many players aren't shown. */
  count: number
  size?: AvatarSize
}

/** The `+4` chip that closes an avatar stack. */
export function AvatarOverflow({ count, size = 30 }: AvatarOverflowProps) {
  return (
    <span
      className={`${styles.avatar} ${styles.overflow}`}
      style={{ width: size, height: size }}
      aria-label={`${count} more ${count === 1 ? 'player' : 'players'}`}
      role="img"
    >
      +{count}
    </span>
  )
}
