'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { CodeEntry } from '@/components/molecules/CodeEntry'
import { generateCode, normalizeCode } from '@/lib/game/codes'
import styles from './LandingActions.module.scss'

/**
 * The two ways in, side by side and given equal weight.
 *
 * An organism because it routes: both paths end in a navigation to
 * `/room/[code]`, and `components/README.md` puts routing at this tier.
 *
 * Starting a room generates the code here rather than asking a server for one.
 * The host's browser *is* the server (ADR 0003), so there is nothing to ask —
 * the code only has to be well-formed and unlikely to collide, which
 * `generateCode` already guarantees.
 */

const LENGTH = 6

export interface LandingActionsProps {
  /** Where a fresh room lives. The generated code is appended. */
  roomBase?: string
}

export function LandingActions({ roomBase = '/room' }: LandingActionsProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)

  const short = LENGTH - code.length
  const ready = short <= 0

  function start() {
    // Seeded from the clock at click time, never during render — a random
    // value in the render path is a hydration mismatch waiting to happen.
    const [fresh] = generateCode(Date.now())
    router.push(`${roomBase}/${fresh}`)
  }

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
      <Button size="form" onClick={start}>
        Start a game — it’s free
      </Button>

      <form
        className={styles.join}
        onSubmit={(e) => {
          e.preventDefault()
          join()
        }}
      >
        <CodeEntry
          value={code}
          onChange={(next) => {
            setCode(next)
            if (error) setError(undefined)
          }}
          onComplete={join}
          error={error}
          size="lg"
        />
        {/* Blocked, not disabled: the label carries what is missing. */}
        <Button type="submit" variant="secondary" size="form" blocked={!ready}>
          {ready ? 'Join the room' : `Enter ${short} more`}
        </Button>
      </form>
    </div>
  )
}
