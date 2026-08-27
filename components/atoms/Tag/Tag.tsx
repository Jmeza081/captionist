import styles from './Tag.module.scss'

export type TagTone = 'accent' | 'neutral' | 'winner'

export interface TagProps {
  /** `accent` for role tags (HOST, PROMPTER), `neutral` for YOU. */
  tone?: TagTone
  children: string
}

/**
 * A short role or ownership marker — HOST, YOU, PROMPTER.
 *
 * Uppercases in CSS, so the string stays sentence case at the call site and
 * screen readers don't get a shouted acronym.
 */
export function Tag({ tone = 'accent', children }: TagProps) {
  return <span className={`${styles.tag} ${styles[tone]}`}>{children}</span>
}
