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
import {
  WAITING_LINE,
  canStart,
  lobbyCopy,
  modeName,
  settingsSummary,
  startLabel,
  toAvatarProps,
} from '@/lib/game/selectors'
import type { GameMode } from '@/lib/game/types'
import { useRoom } from '@/lib/room/useRoom'
import styles from './LobbyScreen.module.scss'

/**
 * The room before it starts: how to get in, who is in, and the one button.
 *
 * Covers all three designed lobby states — host, guest, and "not enough
 * players" — as one screen with branched values. The blocked start is not a
 * separate screen but the same layout with a different headline and a CTA that
 * says what is missing, which is the design's own rule.
 *
 * **A guest is shown, not offered.** The share block, the mode control and the
 * start button are all the host's: a guest gets the settings read-only and a
 * line saying what they are waiting for, because every one of those controls
 * would only ever hand them a refusal.
 */

const MODES: Array<{ value: GameMode; label: string }> = [
  { value: 'caption', label: 'Caption the image' },
  { value: 'react', label: 'React to the caption' },
]

/**
 * Where the QR code and the copied link point.
 *
 * `/join/[code]` rather than the room itself: a guest still needs a name and a
 * face before they can ask for a seat, and landing straight in the room would
 * seat them as an unnamed stranger. This used to emit `/${code}`, which was no
 * route at all — the QR and both copy actions produced a dead link.
 */
function joinUrlFor(code: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window === 'undefined' ? '' : window.location.origin)
  return `${base.replace(/\/$/, '')}/join/${code}`
}

export function LobbyScreen() {
  const { state, selfId, isHost, send } = useRoom()
  const { notify, openHelp } = useRoomShell()
  if (!state) return null

  const copy = lobbyCopy(state, selfId)
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
        {/* The design's guest lobby has no share block: inviting people is the
            host's job, and a guest handed a QR would be sharing a room they do
            not own. */}
        {isHost && (
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
        )}

        <Inline gap={10} wrap={false}>
          {isHost ? (
            <SegmentedControl
              label="Game mode"
              value={state.settings.mode}
              onChange={setMode}
              options={MODES}
            />
          ) : (
            <dl className={styles.settings}>
              {settingsSummary(state).map((pair) => (
                <div key={pair.label} className={styles.setting}>
                  <dt className={styles.settingLabel}>{pair.label}</dt>
                  <dd className={styles.settingValue}>{pair.value}</dd>
                </div>
              ))}
            </dl>
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
          {isHost ? (
            <>
              {/* Blocked, never disabled: the control stays live and focusable
                  and the label carries the reason. */}
              <Button
                size="form"
                fullWidth
                blocked={!gate.ok}
                onClick={() => send({ type: 'game/started' })}
              >
                {startLabel(state)}
              </Button>
              <p className={styles.note}>Late joiners can still hop in between rounds</p>
            </>
          ) : (
            /* Starting is the host's, so a guest is told what they are waiting
               for rather than handed a button that would only refuse them. The
               guest lobby the design draws — its own screen, with no share
               block — arrives with real joining in phase 4. */
            <p className={styles.waiting}>
              <span className={styles.waitingDot} aria-hidden="true" />
              {WAITING_LINE}
            </p>
          )}
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

          <ul className={`${styles.roster} ${isHost ? '' : styles.rosterPills}`}>
            {state.players.map((player) => (
              <li key={player.id}>
                <PlayerRow
                  player={toAvatarProps(player)}
                  variant={isHost ? 'roster' : 'pill'}
                  host={player.isHost}
                  you={player.id === selfId}
                />
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
