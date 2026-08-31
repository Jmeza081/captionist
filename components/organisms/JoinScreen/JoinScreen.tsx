'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Stack } from '@/components/atoms/Stack'
import { TextField } from '@/components/atoms/TextField'
import { AvatarPicker } from '@/components/molecules/AvatarPicker'
import { CodeEntry } from '@/components/molecules/CodeEntry'
import { HatPicker } from '@/components/molecules/HatPicker'
import { HeroWall } from '@/components/molecules/HeroWall'
import { normalizeCode } from '@/lib/game/codes'
import { JOIN_ERRORS, joinCopy } from '@/lib/game/selectors'
import type { HatId } from '@/lib/game/types'
import type { WallTile } from '@/lib/gifs/wall'
import { devGuestDelay } from '@/lib/room/devGuests'
import { writeIdentity } from '@/lib/room/identity'
import { useStoredPerson } from '@/lib/room/useStoredPerson'
import { useSuggestedName } from '@/lib/room/useSuggestedName'
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
 *
 * **The same surface as `/host`**, and for the same reasons: the three fields
 * sit on a card rather than loose on the canvas, the CTA is docked instead of
 * being the thing you scroll a face picker to find, and from `xl` a wall of the
 * app's own GIFs takes the 60% beside it. The two front doors are one screen
 * apart in a guest's session — a host reads a code out, a guest types it — and
 * they were the only two screens in the app that did not look like each other.
 */

const LENGTH = 6

export interface JoinScreenProps {
  /** Prefilled from `/join/[code]` — the QR and the shared link land here. */
  initialCode?: string
  /** The wall beside the form, resolved on the server. See `app/join/page.tsx`. */
  tiles: readonly WallTile[]
  /**
   * This tab is a development guest, and its position in the queue.
   *
   * Set only by `/join/[code]?auto=N` in a non-production build — the page
   * refuses to pass it otherwise — and it makes the screen fill itself in and
   * let itself into the room. The name it uses is the one this tab was already
   * suggesting, which `useSuggestedName` mints fresh per page load, so a row of
   * guest tabs arrives with a row of different names.
   */
  autoJoin?: number
}

export function JoinScreen({ initialCode = '', tiles, autoJoin }: JoinScreenProps) {
  const router = useRouter()
  const copy = joinCopy()

  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState<string | undefined>(undefined)

  // What this browser last used, with anything typed layered over it. Kept this
  // way round rather than seeding state from storage: the stored value arrives
  // at hydration, and seeding would let it land on top of a field somebody had
  // already started filling in.
  //
  // The face is remembered; the nickname is suggested fresh per tab. A
  // remembered name is worse than none when the second tab is the second
  // player — see `useSuggestedName`.
  const stored = useStoredPerson()
  const suggested = useSuggestedName()
  const [typedName, setTypedName] = useState<string | undefined>(undefined)
  const [pickedSeed, setPickedSeed] = useState<string | undefined>(undefined)
  const name = typedName ?? suggested
  const seed = pickedSeed ?? stored.avatarSeed
  /**
   * The hat, and a sentinel that is not `undefined`.
   *
   * `undefined` already means "bare-headed", so it cannot also mean "hasn't
   * touched the picker" — `pickedHat ?? stored.hat` would make "No hat"
   * unclickable, falling straight back to the stored one. The wrapper object
   * is what tells the two apart.
   */
  const [pickedHat, setPickedHat] = useState<{ hat?: HatId } | undefined>(undefined)
  const hat = pickedHat ? pickedHat.hat : stored.hat

  const ready = code.length >= LENGTH && name.trim().length > 0

  function join() {
    const normalized = normalizeCode(`C-${code}`)
    if (!normalized) {
      setError(JOIN_ERRORS.malformed)
      return
    }
    if (name.trim().length === 0) return
    // The room reads these back out of storage when it asks for a seat.
    writeIdentity({ name: name.trim(), avatarSeed: seed, hat })
    router.push(`/room/${normalized}`)
  }

  /**
   * A development guest, letting itself in.
   *
   * Waits its turn rather than joining on load: the person — nickname and face
   * — is one `localStorage` record shared by every tab, so three tabs writing
   * at once would leave all three reading back whichever wrote last, and the
   * roster would show one name three times. See `devGuestDelay`.
   *
   * `joinRef` keeps the effect off `join`'s identity, which changes every
   * render; `fired` makes it once per tab even under a double-invoked effect.
   */
  const joinRef = useRef(join)
  useEffect(() => {
    joinRef.current = join
  })
  const fired = useRef(false)
  useEffect(() => {
    if (autoJoin === undefined || !ready || fired.current) return
    const id = setTimeout(() => {
      if (fired.current) return
      fired.current = true
      joinRef.current()
    }, devGuestDelay(autoJoin))
    return () => clearTimeout(id)
  }, [autoJoin, ready])

  return (
    <div className={styles.screen}>
      <div className={styles.formColumn}>
        <Stack as="main" gap={26} align="center" className={styles.form}>
          <Stack gap={10} className={styles.intro}>
            <h1 className={styles.heading}>{copy.heading}</h1>
            <p className={styles.body}>{copy.body}</p>
          </Stack>

          <Box background="card" radius="modal" padding={26} className={styles.card}>
            <Stack gap={26}>
              <CodeEntry
                value={code}
                onChange={(next) => {
                  setCode(next)
                  if (error) setError(undefined)
                }}
                error={error}
                size="lg"
              />

              {/* One group, because it is one question: who is asking for the
                  seat. The code above it is the other. */}
              <Stack gap={14}>
                <AvatarPicker
                  label={copy.faceLabel}
                  value={seed}
                  onChange={setPickedSeed}
                />

                <HatPicker
                  label={copy.hatLabel}
                  body={copy.hatBody}
                  value={hat}
                  onChange={(next) => setPickedHat({ hat: next })}
                />

                <TextField
                  label={copy.nicknameLabel}
                  size="caption"
                  primary
                  value={name}
                  maxLength={20}
                  placeholder={copy.nicknamePlaceholder}
                  onChange={(e) => setTypedName(e.target.value)}
                />
              </Stack>
            </Stack>
          </Box>

          <p className={styles.helper}>{copy.helper}</p>
        </Stack>

        {/* Both actions dock, not just the primary — `/host`'s dock carries one
            because a host has nowhere else to be. A guest who arrived before
            the host does, and "Make your own" is no use to them if it sits
            under a face picker they have to scroll past. */}
        <div className={styles.dock}>
          <Stack gap={12} align="center" className={styles.actions}>
            {/* Blocked, never disabled: the label says what is still missing. */}
            <Button size="form" fullWidth blocked={!ready} onClick={() => ready && join()}>
              {ready ? copy.action : code.length < LENGTH ? 'Enter the code' : JOIN_ERRORS.noName}
            </Button>
            <Button variant="ghost" href="/host">
              {copy.secondary}
            </Button>
          </Stack>
        </div>
      </div>

      {/* Not `aria-hidden` on the wrapper: the wall inside it already is, and
          the pause control it renders beside the wall is real UI. */}
      <aside className={styles.showcase}>
        <HeroWall tiles={tiles} scrim="soft" />
      </aside>
    </div>
  )
}
