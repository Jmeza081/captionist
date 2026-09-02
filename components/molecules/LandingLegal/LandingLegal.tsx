'use client'

import { useState } from 'react'
import { LicenseModal } from '@/components/molecules/LicenseModal'
import styles from './LandingLegal.module.scss'

/**
 * The landing page's foot: the licences, and nothing else.
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
 *
 * **One link, not two.** It carried the repository as well, which the nav's
 * own "GitHub" already does — two links to one destination on one screen is a
 * reader wondering what the difference is.
 */
export function LandingLegal() {
  const [open, setOpen] = useState(false)

  return (
    <footer className={styles.foot}>
      <button type="button" className={styles.link} onClick={() => setOpen(true)}>
        Licensing and credits
      </button>

      <LicenseModal open={open} onClose={() => setOpen(false)} />
    </footer>
  )
}
