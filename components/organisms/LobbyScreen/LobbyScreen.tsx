'use client'

import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { Stack } from '@/components/atoms/Stack'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { RoomShare } from '@/components/molecules/RoomShare'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { MAX_PLAYERS } from '@/lib/game/constants'
import { canStart, lobbyCopy, modeName, startLabel, toAvatarProps } from '@/lib/game/selectors'
import type { GameMode } from '@/lib/game/types'
import { useRoom } from '@/lib/room/useRoom'
import styles from './LobbyScreen.module.scss'

/**
 * The room before it starts: how to get in, who is in, and the one button.
 *
 * Covers both designed lobby states. "Not enough players" is not a separate
 * screen — it is the same layout with a different headline and a blocked CTA
 * that says what is missing, which is the design's own rule.
 *
 * The guest lobby (no controls, settings shown read-only) arrives with real
 * joining in phase 4; today the only player in the room is the host.
 */

const MODES: Array<{ value: GameMode; label: string }> = [
  { value: 'caption', label: 'Caption the image' },
  { value: 'react', label: 'React to the caption' },
]

function joinUrlFor(code: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window === 'undefined' ? '' : window.location.origin)
  return `${base.replace(/\/$/, '')}/${code}`
}

export function LobbyScreen() {
  const { state, isHost, send } = useRoom()
  const { notify, openHelp } = useRoomShell()
  if (!state) return null

  const copy = lobbyCopy(state)
  const gate = canStart(state)
  const joinUrl = joinUrlFor(state.roomCode)

  const setMode = (mode: GameMode) => {
    if (mode === state.settings.mode) return
    send({ type: 'room/settingsChanged', patch: { mode } })
    notify(`Mode set to ${modeName(mode)}`)
  }

  return (
    <Inline gap={44} align="start" className={styles.lobby}>
      <Stack gap={26} className={styles.share}>
        <Stack gap={12}>
          <Eyebrow>Scan or type the code</Eyebrow>
          <RoomShare
            code={state.roomCode}
            joinUrl={joinUrl}
            onCopyLink={() => {
              void navigator.clipboard?.writeText(joinUrl)
              notify('Room link copied')
            }}
            onShareToSlack={() => {
              void navigator.clipboard?.writeText(joinUrl)
              notify('Link copied — paste it into Slack')
            }}
          />
        </Stack>

        <Inline gap={10}>
          {isHost && (
            <SegmentedControl
              label="Game mode"
              value={state.settings.mode}
              onChange={setMode}
              options={MODES}
            />
          )}
          <button
            type="button"
            className={styles.help}
            onClick={openHelp}
            aria-label="How Captionist works"
          >
            <Icon name="help" size={17} color="#A18FFF" />
          </button>
        </Inline>

        <Stack gap={10}>
          <h1 className={styles.heading}>{copy.heading}</h1>
          <p className={styles.blurb}>{copy.body}</p>
        </Stack>

        <Stack gap={10} align="stretch">
          {/* Blocked, never disabled: the control stays live and focusable and
              the label carries the reason. */}
          <Button
            size="form"
            fullWidth
            blocked={!gate.ok}
            onClick={() => send({ type: 'game/started' })}
          >
            {startLabel(state)}
          </Button>
          <p className={styles.note}>Late joiners can still hop in between rounds</p>
        </Stack>
      </Stack>

      <Box background="card" radius="card" padding={20} className={styles.rosterCard}>
        <Stack gap={14}>
          <Inline justify="between" align="baseline">
            <h2 className={styles.rosterTitle}>Player list</h2>
            <span className={styles.count}>
              {state.players.length} of {MAX_PLAYERS}
            </span>
          </Inline>

          <ul className={styles.roster}>
            {state.players.map((player) => (
              <li key={player.id}>
                <PlayerRow player={toAvatarProps(player)} host={player.isHost} />
              </li>
            ))}
            {!gate.ok && (
              <li>
                <div className={styles.empty}>
                  <span className={styles.emptyDot} aria-hidden="true" />
                  Waiting for a friend…
                </div>
              </li>
            )}
          </ul>
        </Stack>
      </Box>
    </Inline>
  )
}
