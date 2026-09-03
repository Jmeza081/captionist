'use client'

import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { HelpKey } from '@/components/atoms/HelpKey'
import { Wordmark } from '@/components/molecules/Wordmark'
import { HelpModal } from '@/components/molecules/HelpModal'
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
 *
 * `'use client'` buys one thing: "How it works" opens the same walkthrough the
 * lobby and the toolbox open, rather than jumping to an explainer section that
 * does not exist. The markup still server-renders.
 */
export interface LandingNavProps {
  /** Where "Join a room" goes. */
  joinHref: string
  repoHref: string
}

export function LandingNav({ joinHref, repoHref }: LandingNavProps) {
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <header className={styles.nav}>
      <Wordmark size="landing" />

      <nav className={styles.links} aria-label="Captionist">
        <button type="button" className={styles.link} onClick={() => setHelpOpen(true)}>
          How it works
        </button>
        <a className={styles.link} href={repoHref} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>

        {/* The same walkthrough, in the space a phone has for it. The words
            stand down above; the key stands down below, so exactly one of the
            two is ever in the bar. */}
        <HelpKey
          tone="outline"
          onClick={() => setHelpOpen(true)}
          className={styles.helpKey}
        />

        <Button href={joinHref} variant="outline" size="small">
          Join a room
        </Button>
      </nav>

      {/* No room yet, so no format is in play: the walkthrough opens on
          captions and the switcher marks nothing. */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  )
}
