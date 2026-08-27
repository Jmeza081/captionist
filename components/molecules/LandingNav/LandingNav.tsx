import { Button } from '@/components/atoms/Button'
import styles from './LandingNav.module.scss'

/**
 * The public front door's bar.
 *
 * Not a variant of `AppHeader`: that one is 88px of live room state — phase on
 * the left, clock on the right, redrawn on every broadcast. This is a static
 * marketing bar with links and a way in. They share a wordmark and nothing
 * else, and a variant would have each carrying props the other never sets.
 *
 * A molecule rather than an atom because it composes `Button` — the tier is
 * decided by what a thing depends on, not by how big it is.
 */
export interface LandingNavProps {
  /** Where "Join a room" goes. */
  joinHref: string
  repoHref: string
  /** Anchor for the explainer further down the page. */
  howHref?: string
}

export function LandingNav({ joinHref, repoHref, howHref = '#how' }: LandingNavProps) {
  return (
    <header className={styles.nav}>
      <span className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.wordmark}>Captionist</span>
      </span>

      <nav className={styles.links} aria-label="Captionist">
        <a className={styles.link} href={howHref}>
          How it works
        </a>
        <a className={styles.link} href={repoHref} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>
        <Button href={joinHref} variant="outline" size="small">
          Join a room
        </Button>
      </nav>
    </header>
  )
}
