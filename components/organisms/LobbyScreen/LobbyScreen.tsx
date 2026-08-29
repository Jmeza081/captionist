'use client'

import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { Stack } from '@/components/atoms/Stack'
import { StatusPill } from '@/components/atoms/StatusPill'
import { WaitingDots } from '@/components/atoms/WaitingDots'
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
import type { GameMode, GameState, PlayerId } from '@/lib/game/types'
import { useRoom } from '@/lib/room/useRoom'
import styles from './LobbyScreen.module.scss'

/**
 * The room before it starts: how to get in, who is in, and the one button.
 *
 * **Two layouts, because the design draws two artboards.** A host's lobby is a
 * work surface — a QR to share, a mode to set, a button to press — and it is
 * laid out as one, two columns of controls. A guest's is a waiting room: the
 * design centres it, sets the headline at display scale, and gives it exactly
 * one card and no controls at all. That is not a host lobby with things hidden,
 * and pretending otherwise is what left a guest reading the host's column
 * layout with its left-hand side empty.
 *
 * The two are branches here rather than two organisms because they are one
 * phase and share their whole vocabulary — `lobbyCopy`, `settingsSummary`,
 * `PlayerRow`, the roster. What differs is arrangement, which is what a branch
 * is for. Compare the mode/format branching *inside* each: values, never forks.
 *
 * **A guest is shown, not offered.** The share block, the mode control and the
 * start button are all the host's, because every one of them would only ever
 * hand a guest a refusal.
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

  return isHost ? (
    <HostLobby state={state} selfId={selfId} send={send} notify={notify} openHelp={openHelp} />
  ) : (
    <GuestLobby state={state} selfId={selfId} />
  )
}

/* ------------------------------------------------------------------ */
/* Guest                                                               */
/* ------------------------------------------------------------------ */

/**
 * Waiting for the host, centred.
 *
 * Answers the only two questions a waiting player has — am I actually in, and
 * who else is here — and answers them in that order, top to bottom. Everything
 * a host would act on is absent rather than disabled, because there is nothing
 * here for a guest to do but read.
 */
function GuestLobby({ state, selfId }: { state: GameState; selfId?: PlayerId }) {
  const copy = lobbyCopy(state, selfId)

  return (
    <div className={styles.guest}>
      <Stack gap={34} align="center" className={styles.guestColumn}>
        <Stack gap={52} align="center" className={styles.guestBlocks}>
          <Stack gap={26} align="center">
            {/* Decorative: the headline under it already says what the wait is,
                and announcing it twice is once too many. */}
            <WaitingDots />
            <Stack gap={20} align="center">
              <h1 className={styles.guestHeading}>{copy.heading}</h1>
              <p className={styles.guestBlurb}>{copy.body}</p>
            </Stack>
          </Stack>

          <Box background="card" radius="modal" padding={26} className={styles.guestCard}>
            <Stack gap={20}>
              <Inline justify="between" align="baseline">
                <h2 className={styles.rosterTitle}>In the room</h2>
                <span className={styles.count}>
                  {state.players.length} {state.players.length === 1 ? 'player' : 'players'}
                </span>
              </Inline>

              <ul className={styles.rosterPills}>
                {state.players.map((player) => (
                  <li key={player.id}>
                    <PlayerRow
                      player={toAvatarProps(player)}
                      variant="pill"
                      host={player.isHost}
                      you={player.id === selfId}
                    />
                  </li>
                ))}
              </ul>

              <hr className={styles.rule} />

              {/* The rules, read-only. The same four pairs the host set, in the
                  same order they set them. */}
              <dl className={styles.settings}>
                {settingsSummary(state).map((pair) => (
                  <div key={pair.label} className={styles.setting}>
                    <dt className={styles.settingLabel}>{pair.label}</dt>
                    <dd className={styles.settingValue}>{pair.value}</dd>
                  </div>
                ))}
              </dl>
            </Stack>
          </Box>
        </Stack>

        <StatusPill waiting>{WAITING_LINE}</StatusPill>
      </Stack>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Host                                                                */
/* ------------------------------------------------------------------ */

/**
 * The room's work surface: share it, set it, start it.
 *
 * Two columns once the container can hold them — the share block is a fixed
 * measure and the roster takes the rest. The blocked start is not a separate
 * screen but the same layout with a different headline and a CTA that says
 * what is missing, which is the design's own rule.
 */
function HostLobby({
  state,
  selfId,
  send,
  notify,
  openHelp,
}: {
  state: GameState
  selfId?: PlayerId
  send: ReturnType<typeof useRoom>['send']
  notify: (message: string) => void
  openHelp: () => void
}) {
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

        <Inline gap={10} wrap={false}>
          <SegmentedControl
            label="Game mode"
            value={state.settings.mode}
            onChange={setMode}
            options={MODES}
          />
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
                <PlayerRow
                  player={toAvatarProps(player)}
                  variant="roster"
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
