'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { QuickJoin } from '@/components/molecules/QuickJoin'
import { normalizeCode } from '@/lib/game/codes'
import styles from './LandingActions.module.scss'

/**
 * The two ways in, side by side and given equal weight.
 *
 * An organism because it routes: both paths end in a navigation to
 * `/room/[code]`, and `components/README.md` puts routing at this tier.
 *
 * Starting a room goes through `/host` first, which is where the design puts
 * the decisions — the code is generated there, on the way out. Joining pushes
 * straight at the room, because a typed code is already the answer to the only
 * question that screen asks.
 */

const LENGTH = 6

export interface LandingActionsProps {
  /** Where a fresh room lives. The generated code is appended. */
  roomBase?: string
  /** Where "Start a game" goes to pick the room's rules. */
  hostHref?: string
}

export function LandingActions({
  roomBase = '/room',
  hostHref = '/host',
}: LandingActionsProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)

  const short = LENGTH - code.length
  const ready = short <= 0

  function join() {
    if (!ready) return
    const normalized = normalizeCode(`C-${code}`)
    if (!normalized) {
      setError('That isn’t a room code. Check the one on the shared screen.')
      return
    }
    setError(undefined)
    router.push(`${roomBase}/${normalized}`)
  }

  return (
    <div className={styles.actions}>
      {/* A link, not a button: starting a game is a navigation to the setup
          screen, so it previews on hover and works before hydration. Matched to
          the join pill beside it — see `$landing-cta-height`. */}
      <Button size="form" href={hostHref} className={styles.start}>
        Start a game — it’s free
      </Button>

      {/* The landing page's own control, not the `/join` route's slots — see
          `QuickJoin`. Blocked, not disabled: the key stays live and its label
          carries what is missing. */}
      <QuickJoin
        value={code}
        onChange={(next) => {
          setCode(next)
          if (error) setError(undefined)
        }}
        onSubmit={join}
        actionLabel={ready ? 'Join' : `Enter ${short} more`}
        blocked={!ready}
        error={error}
      />
    </div>
  )
}
