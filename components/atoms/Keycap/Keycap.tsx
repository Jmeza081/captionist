import styles from './Keycap.module.scss'

export interface KeycapProps {
  /** What is printed on the key — "P", "⌥", "Alt". */
  children: string
  /**
   * `sm` is the header hint, `lg` is the flash.
   *
   * Two fixed sizes rather than a number, because a keycap has to stay square
   * enough to read as a key: the padding, the radius and the type all move
   * together, and a caller picking a height would get one of the three wrong.
   */
  size?: 'sm' | 'lg'
}

/**
 * One key, drawn as a key.
 *
 * Its whole job is to say "this is a thing on your keyboard" rather than "this
 * is a word we have styled" — so it is a raised surface with a lit top edge,
 * not a `Tag`. `$shadow-glass` supplies the edge: it exists for the landing
 * page's frosted pill, which needed the same lit rim to sit on top of moving
 * media rather than look cut out of it.
 *
 * **Decorative by default.** A keycap is a picture of a key, and a screen
 * reader that meets ⌥ and P as two separate one-character labels learns
 * nothing. The text around it does the telling, so the caller hides these and
 * writes the shortcut into a sentence — see `ShortcutHint`.
 */
export function Keycap({ children, size = 'sm' }: KeycapProps) {
  return <span className={`${styles.cap} ${styles[size]}`}>{children}</span>
}
