'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Stack } from '@/components/atoms/Stack'
import { TextField } from '@/components/atoms/TextField'
import { AvatarPicker } from '@/components/molecules/AvatarPicker'
import { CodeEntry } from '@/components/molecules/CodeEntry'
import { normalizeCode } from '@/lib/game/codes'
import { JOIN_ERRORS, joinCopy } from '@/lib/game/selectors'
import { writeIdentity } from '@/lib/room/identity'
import { useStoredPerson } from '@/lib/room/useStoredPerson'
import styles from './JoinScreen.module.scss'

/**
 * The way into somebody else's room.
 *
 * An organism because it routes — it calls no `useRoom()`, because there is no
 * room yet. That is the whole point of the screen: it collects the three things
 * a seat needs (which room, what to call you, which face) *before* the transport
 * is asked for one.
 *
 * Nickname and face are written to `localStorage` on submit rather than sent
 * anywhere. `RoomProvider` reads them back when it asks the host for a seat, so
 * this screen never has to know a transport exists.
 */

const LENGTH = 6

export interface JoinScreenProps {
  /** Prefilled from `/join/[code]` — the QR and the shared link land here. */
  initialCode?: string
}

export function JoinScreen({ initialCode = '' }: JoinScreenProps) {
  const router = useRouter()
  const copy = joinCopy()

  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState<string | undefined>(undefined)

  // What this browser last used, with anything typed layered over it. Kept this
  // way round rather than seeding state from storage: the stored value arrives
  // at hydration, and seeding would let it land on top of a field somebody had
  // already started filling in.
  const stored = useStoredPerson()
  const [typedName, setTypedName] = useState<string | undefined>(undefined)
  const [pickedSeed, setPickedSeed] = useState<string | undefined>(undefined)
  const name = typedName ?? stored.name
  const seed = pickedSeed ?? stored.avatarSeed

  const ready = code.length >= LENGTH && name.trim().length > 0

  function join() {
    const normalized = normalizeCode(`C-${code}`)
    if (!normalized) {
      setError(JOIN_ERRORS.malformed)
      return
    }
    if (name.trim().length === 0) return
    // The room reads these back out of storage when it asks for a seat.
    writeIdentity({ name: name.trim(), avatarSeed: seed })
    router.push(`/room/${normalized}`)
  }

  return (
    <Stack as="main" gap={34} align="center" className={styles.screen}>
      <Stack gap={10} align="center">
        <h1 className={styles.heading}>{copy.heading}</h1>
        <p className={styles.body}>{copy.body}</p>
      </Stack>

      <Stack gap={26} className={styles.form}>
        <CodeEntry
          value={code}
          onChange={(next) => {
            setCode(next)
            if (error) setError(undefined)
          }}
          error={error}
          size="lg"
        />

        <AvatarPicker label={copy.faceLabel} value={seed} onChange={setPickedSeed} />

        <TextField
          label={copy.nicknameLabel}
          size="caption"
          primary
          value={name}
          maxLength={20}
          placeholder={copy.nicknamePlaceholder}
          onChange={(e) => setTypedName(e.target.value)}
        />

        {/* Blocked, never disabled: the label says what is still missing. */}
        <Button size="form" fullWidth blocked={!ready} onClick={() => ready && join()}>
          {ready ? copy.action : code.length < LENGTH ? 'Enter the code' : JOIN_ERRORS.noName}
        </Button>

        <Stack gap={12} align="center">
          {/* Kept visible for a guest who arrived before the host did. */}
          <Button variant="ghost" href="/host">
            {copy.secondary}
          </Button>
          <p className={styles.helper}>{copy.helper}</p>
        </Stack>
      </Stack>
    </Stack>
  )
}
