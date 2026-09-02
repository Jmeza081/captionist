'use client'

import { useState } from 'react'
import { LicenseModal } from '@/components/molecules/LicenseModal'
import styles from './LandingLegal.module.scss'

export interface LandingLegalProps {
  /** The public repository, so the line carries the source as well as the terms. */
  repoHref: string
}

/**
 * The landing page's foot: the year, the source, and the licences.
 *
 * A molecule holding a molecule, like `HelpModal` — the state is one boolean
 * and the reason it is a component at all is that `app/page.tsx` is a Server
 * Component and a modal is not. Keeping the `'use client'` boundary down here
 * means the headline, the wall and the proof row all still render on the
 * server; the only thing shipped for this is a button.
 *
 * Not in `LandingNav`. The bar has three items and the third is the way in;
 * "Licensing" beside "Join a room" competes with the one action the page is
 * for. A foot is where somebody goes looking for terms anyway.
 */
export function LandingLegal({ repoHref }: LandingLegalProps) {
  const [open, setOpen] = useState(false)

  return (
    <footer className={styles.foot}>
      <span className={styles.line}>
        <button type="button" className={styles.link} onClick={() => setOpen(true)}>
          Licensing and credits
        </button>
        <span className={styles.dot} aria-hidden="true">
          ·
        </span>
        <a
          className={styles.link}
          href={repoHref}
          target="_blank"
          rel="noreferrer noopener"
        >
          Source on GitHub
        </a>
      </span>

      <LicenseModal open={open} onClose={() => setOpen(false)} />
    </footer>
  )
}
