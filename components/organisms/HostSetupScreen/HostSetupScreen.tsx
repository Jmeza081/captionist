'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Inline } from '@/components/atoms/Inline'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { Stack } from '@/components/atoms/Stack'
import { Stepper } from '@/components/atoms/Stepper'
import { TextField } from '@/components/atoms/TextField'
import { Toggle } from '@/components/atoms/Toggle'
import { AvatarPicker } from '@/components/molecules/AvatarPicker'
import { ModeCard } from '@/components/molecules/ModeCard'
import { generateCode } from '@/lib/game/codes'
import {
  CAP_SECONDS_MAX,
  CAP_SECONDS_MIN,
  CAP_SECONDS_STEP,
  DEFAULT_SETTINGS,
  ROUNDS_MAX,
  ROUNDS_MIN,
} from '@/lib/game/constants'
import { hostSetupCopy, modeChoices, showsCaptionFormat } from '@/lib/game/selectors'
import type { GameMode, RoomSettings } from '@/lib/game/types'
import { AVATAR_SEEDS } from '@/lib/avatar'
import { writeIdentity } from '@/lib/room/identity'
import { writePendingSettings } from '@/lib/room/pendingSettings'
import { useStoredPerson } from '@/lib/room/useStoredPerson'
import styles from './HostSetupScreen.module.scss'

/**
 * The only screen where the room's rules are decided.
 *
 * An organism because it routes, and like `JoinScreen` it calls no `useRoom()`
 * — the room does not exist until "Open the room" pushes to `/room/[code]`,
 * where this tab claims the code and builds it.
 *
 * **The defaults are playable as-is.** That is the design's own note, and it is
 * why every control starts from `DEFAULT_SETTINGS` and nothing here is
 * required: a host who reads none of it still gets a working game.
 */

export function HostSetupScreen() {
  const router = useRouter()
  const copy = hostSetupCopy()

  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS)

  // See `JoinScreen`: stored underneath, typed on top.
  const stored = useStoredPerson()
  const [typedName, setTypedName] = useState<string | undefined>(undefined)
  const [pickedSeed, setPickedSeed] = useState<string | undefined>(undefined)
  const name = typedName ?? stored.name
  const seed = pickedSeed ?? stored.avatarSeed

  const patch = (next: Partial<RoomSettings>) => setSettings((s) => ({ ...s, ...next }))

  function open() {
    writeIdentity({ name: name.trim() || 'Host', avatarSeed: seed })
    writePendingSettings(settings)
    // Nothing asks a server for a code, because under ADR 0003 there is no
    // server to ask: the code only has to be well-formed and unlikely to clash.
    const [code] = generateCode(Date.now())
    router.push(`/room/${code}`)
  }

  return (
    <Stack as="main" gap={26} align="center" className={styles.screen}>
      <h1 className={styles.heading}>{copy.heading}</h1>

      <Box background="card" radius="modal" padding={26} className={styles.card}>
        <Stack gap={26}>
          <Stack gap={14}>
            <h2 className={styles.section}>{copy.hostSection}</h2>
            <AvatarPicker label="Your face" value={seed} onChange={setPickedSeed} />
            <TextField
              label="Nickname"
              size="caption"
              primary
              value={name}
              maxLength={20}
              placeholder="What should we call you?"
              onChange={(e) => setTypedName(e.target.value)}
              trailing={
                <Button
                  variant="ghost"
                  size="inline"
                  onClick={() =>
                    setPickedSeed(
                      AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)] ?? seed,
                    )
                  }
                >
                  {copy.shuffle}
                </Button>
              }
            />
          </Stack>

          <Stack gap={12}>
            <Stack gap={5}>
              <h2 className={styles.section}>{copy.modeSection}</h2>
              <p className={styles.sub}>{copy.modeBody}</p>
            </Stack>
            <div className={styles.modes} role="radiogroup" aria-label={copy.modeSection}>
              {modeChoices(settings.mode).map((choice) => (
                <ModeCard
                  key={choice.mode}
                  title={choice.title}
                  body={choice.body}
                  tag={choice.tag}
                  selected={settings.mode === choice.mode}
                  onSelect={() => patch({ mode: choice.mode as GameMode })}
                />
              ))}
            </div>
          </Stack>

          <Stack gap={20}>
            <h2 className={styles.section}>{copy.settingsSection}</h2>

            <Toggle
              label={copy.giphyLabel}
              checked={settings.giphyEnabled}
              onChange={(giphyEnabled) => patch({ giphyEnabled })}
            />
            <Toggle
              label={copy.uniqueLabel}
              checked={settings.uniqueNicknames}
              onChange={(uniqueNicknames) => patch({ uniqueNicknames })}
            />
            {/* Blocked rather than hidden: the design draws it, and saying why
                is more honest than pretending it was never offered. */}
            <Stack gap={5}>
              <Toggle label={copy.uploadsLabel} checked={false} onChange={() => {}} disabled />
              <p className={styles.reason}>{copy.uploadsReason}</p>
            </Stack>

            <hr className={styles.rule} />

            {/* The design drops this row entirely in react mode — there is no
                caption to format. A value, not a fork. */}
            {showsCaptionFormat(settings.mode) && (
              <Inline gap={20} justify="between">
                <span className={styles.rowLabel}>{copy.formatLabel}</span>
                <SegmentedControl
                  label={copy.formatLabel}
                  surface="card"
                  value={settings.format}
                  onChange={(format) => patch({ format })}
                  options={[
                    { value: 'tb', label: 'Top + bottom' },
                    { value: 'one', label: 'One line' },
                  ]}
                />
              </Inline>
            )}

            <Inline gap={20} justify="between">
              <span className={styles.rowLabel}>{copy.votingLabel}</span>
              <SegmentedControl
                label={copy.votingLabel}
                surface="card"
                value={settings.voting}
                onChange={(voting) => patch({ voting })}
                options={[
                  { value: 'rank', label: 'Rank top 3' },
                  { value: 'single', label: 'Single vote' },
                ]}
              />
            </Inline>

            <Stepper
              label={copy.capLabel}
              value={settings.capSeconds}
              format={(n) => `${n} sec`}
              step={CAP_SECONDS_STEP}
              min={CAP_SECONDS_MIN}
              max={CAP_SECONDS_MAX}
              onChange={(capSeconds) => patch({ capSeconds })}
            />

            <Stepper
              label={copy.roundsLabel}
              value={settings.totalRounds}
              format={(n) => String(n)}
              min={ROUNDS_MIN}
              max={ROUNDS_MAX}
              onChange={(totalRounds) => patch({ totalRounds })}
            />
          </Stack>

          <Button size="form" fullWidth onClick={open}>
            {copy.action}
          </Button>
        </Stack>
      </Box>
    </Stack>
  )
}
