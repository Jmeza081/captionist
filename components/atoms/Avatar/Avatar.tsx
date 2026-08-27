import styles from './Avatar.module.scss'

/** The eight sizes the design specifies, in px. */
export const AVATAR_SIZES = [26, 30, 34, 40, 46, 56, 88, 108] as const
export type AvatarSize = (typeof AVATAR_SIZES)[number]

export interface AvatarProps {
  /** Player name. Drives the initial and the accessible label. */
  name: string
  /** The player's colour — the circle behind the art. */
  color: string
  /** Avatar art. Falls back to the player's initial when absent. */
  src?: string
  size?: AvatarSize
  /** Chosen in setup: gains a 2px accent ring. */
  selected?: boolean
  /** Not chosen, or not yet acted: drops to 55%. */
  dimmed?: boolean
}

/**
 * A player, as a colour-filled circle with their art inset to ~78%.
 *
 * Art is optional so a room works before avatars load — the initial on the
 * player's own colour is still identifying.
 */
export function Avatar({
  name,
  color,
  src,
  size = 40,
  selected = false,
  dimmed = false,
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

  return (
    <span
      className={classes}
      style={{ width: size, height: size, backgroundColor: color }}
      role="img"
      aria-label={selected ? `${name}, selected` : name}
    >
      {src ? (
        // Avatar art is a fixed-size sprite, not a responsive image, so
        // next/image would add a loader round-trip for nothing.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={art} height={art} className={styles.art} />
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
