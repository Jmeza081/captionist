'use client'

import { useEffect, useState } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Inline } from '@/components/atoms/Inline'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { Stack } from '@/components/atoms/Stack'
import { StatusPill } from '@/components/atoms/StatusPill'
import { WaitingDots } from '@/components/atoms/WaitingDots'
import { BotPicker } from '@/components/molecules/BotPicker'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { RoomShare } from '@/components/molecules/RoomShare'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { budgetSpent } from '@/lib/bots/budget'
import {
  WAITING_LINE,
  canStart,
  lobbyCopy,
  roomRulesLine,
  rosterCopy,
  settingsSummary,
  startLabel,
  toAvatarProps,
} from '@/lib/game/selectors'
import type { GameMode, GameState, PlayerId } from '@/lib/game/types'
import { useBots, useRoom } from '@/lib/room/useRoom'
import { useWebShare } from '@/lib/useWebShare'
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

/**
 * The two modes, at their full names on every screen.
 *
 * The names are worth their width: this control is where somebody who has
 * never played learns what the two modes are, and an abbreviation would make
 * the toggle a thing you set rather than a thing you read. On a phone they
 * used to wrap to three ragged lines, because the toggle hugged its content
 * and shared the row with the walkthrough key. The key is in the header now
 * and the track is `fullWidth`, which is room enough for both.
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
  const { notify } = useRoomShell()
  if (!state) return null

  return isHost ? (
    <HostLobby state={state} selfId={selfId} send={send} notify={notify} />
  ) : (
    <GuestLobby state={state} selfId={selfId} />
  )
}

/**
 * A second hand, for the one line on one screen that needs one.
 *
 * The lobby is the only screen in the room with no clock — nothing is running
 * yet — so the shell's single interval is idle here, and "Vic joined 4 seconds
 * ago" is the one thing on the page that goes stale on its own. It stops the
 * moment the game starts, because this component unmounts.
 *
 * Deliberately not in `RoomShell`: every other screen would pay a re-render a
 * second for a line none of them draws.
 */
function useSecondHand(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [])
  return now
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
                      player={toAvatarProps(state, player)}
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
 * **One column on a phone, two on a desk, and the order differs.** A phone
 * reads share card → mode → what the game is → who is here, with the start
 * button pinned to the foot; a desk keeps the design's two artboard columns,
 * controls on the left and the roster on the right. That is a real divergence
 * rather than a reflow, and it is deliberate: on a phone the roster is what
 * you watch while you wait, so it wants the bottom of the column and the
 * button wants the glass. On a desk both are on screen at once and neither
 * has to give way.
 *
 * The blocked start is not a separate screen but the same layout with a
 * different headline and a CTA that says what is missing, which is the
 * design's own rule.
 */
function HostLobby({
  state,
  selfId,
  send,
  notify,
}: {
  state: GameState
  selfId?: PlayerId
  send: ReturnType<typeof useRoom>['send']
  notify: (message: string) => void
}) {
  const copy = lobbyCopy(state, selfId)
  const gate = canStart(state)
  const joinUrl = joinUrlFor(state.roomCode)
  const roster = rosterCopy(state, selfId, useSecondHand())
  const web = useWebShare()
  const { hireBot } = useBots()
  // Lobby-only, so `useState` here rather than `RoomShell`'s `overlay` — the
  // same call `HostSetupScreen` makes for its own help modal.
  const [hiring, setHiring] = useState(false)
  const full = state.players.length >= state.settings.maxPlayers

  const setMode = (mode: GameMode) => {
    if (mode === state.settings.mode) return
    // No `notify` here any more. The host engine announces a mode change to the
    // whole room, and that line reaches this tab too — as a chat toast when the
    // rail is shut, which is where a snackbar would have been. Keeping both
    // told the person who tapped twice and everybody else once. See ADR 0028.
    send({ type: 'room/settingsChanged', patch: { mode } })
  }

  return (
    <div className={styles.lobby}>
      <div className={styles.columns}>
        <Stack gap={26} className={styles.share}>
          {/* A card on a phone, a plain block on a desk — the phone needs
              something holding the QR, the code and the two actions together
              when they are the whole top of the screen. See the stylesheet. */}
          <Stack gap={12} className={styles.shareHead}>
            <Eyebrow>Scan or type the code</Eyebrow>
            <RoomShare
              code={state.roomCode}
              joinUrl={joinUrl}
              // Where a phone reads the room's rules, because its header has no
              // width for them. Mode left out: the toggle below says it.
              meta={roomRulesLine(state)}
              onCopyLink={() => {
                void navigator.clipboard?.writeText(joinUrl)
                notify('Room link copied')
              }}
              /*
                The OS sheet on a phone, the clipboard everywhere else.

                Nothing is announced when the sheet opens: the sheet is the
                result, and confirming it under itself would be the room
                telling you about the thing covering the room. A cancel says
                nothing either — that was a decision, not a failure.
              */
              shareLabel={web.supported ? 'Share link' : 'Share to Slack'}
              onShare={() => {
                void web
                  .share({
                    title: 'Captionist',
                    text: `Join room ${state.roomCode} on Captionist.`,
                    url: joinUrl,
                  })
                  .then((outcome) => {
                    if (outcome === 'copied') notify('Link copied — paste it into Slack')
                    else if (outcome === 'failed') notify('Couldn’t share the link. Read the code out instead.')
                  })
              }}
            />
          </Stack>

          {/* The whole row is the toggle now. The walkthrough key that used to
              share it moved to the header — see `RoomShell` — which is what
              lets both mode names stay whole on a phone. */}
          <div className={styles.modeRow}>
            <SegmentedControl
              label="Game mode"
              value={state.settings.mode}
              onChange={setMode}
              options={MODES}
              fullWidth
            />
          </div>

          <Stack gap={10}>
            {/* The heading is a desk's. A phone opens on a card carrying the
                code and a toggle carrying the mode, and "Everybody in?" over
                the top of them is a third voice saying nothing the blurb does
                not — so it stands down there and stays in the document. */}
            <h1 className={styles.heading}>{copy.heading}</h1>
            <p className={styles.blurb}>{copy.body}</p>
          </Stack>
        </Stack>

        <div className={styles.rosterCard}>
          <Stack gap={14}>
            <Inline justify="between" align="baseline">
              <h2 className={styles.rosterTitle}>Players</h2>
              <span className={styles.count}>
                {state.players.length} of {state.settings.maxPlayers}
              </span>
            </Inline>

            {/* A window three rows deep on a phone, the whole list on a desk.
                Twenty rows above a pinned button is a lobby you scroll past
                rather than read; `.overflow` below says who is out of sight. */}
            <ul className={styles.roster}>
              {state.players.map((player) => (
                <li key={player.id}>
                  <PlayerRow
                    player={toAvatarProps(state, player)}
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
              {/* A seat you can fill yourself, drawn as the seat it fills —
                  beside the one you are waiting on somebody else to take.
                  Blocked rather than disabled, naming what is missing
                  (ADR 0032). A `button` in the placeholder's own clothes
                  rather than the pill `Button`: this is a roster slot that
                  happens to be interactive, not an action row. */}
              <li>
                <button
                  type="button"
                  className={`${styles.empty} ${styles.hire} ${full ? styles.hireBlocked : ''}`}
                  aria-disabled={full || undefined}
                  onClick={() => {
                    if (full) {
                      notify(`This room is full — ${state.settings.maxPlayers} players is the limit.`)
                      return
                    }
                    setHiring(true)
                  }}
                >
                  <span className={styles.emptyDot} aria-hidden="true" />
                  {full ? 'Add a bot — room is full' : 'Add a bot'}
                </button>
              </li>
            </ul>

            {/* Only where the window actually hides somebody. Both lines are
                the phone's — a desk shows the roster whole and announces
                arrivals in the room's own lane. */}
            {roster.hidden && (
              <p className={styles.overflow}>
                <Avatar {...roster.hidden.face} size={26} />
                {roster.hidden.line}
              </p>
            )}
            {roster.arrival && (
              <p className={styles.arrival}>
                <span className={styles.arrivalDot} aria-hidden="true" />
                {roster.arrival}
              </p>
            )}

          </Stack>
        </div>
      </div>

      {/**
        * A sibling of `.columns`, never a child. That box is a query container
        * and therefore the containing block for `position: fixed`, so a
        * backdrop nested inside it would cover the column rather than the room.
        */}
      <BotPicker
        open={hiring}
        onClose={() => setHiring(false)}
        onHire={(difficulty) => {
          // **No `notify` on success, and no announcement either.** A hire is
          // a join, and ADR 0028 settled that a join gets no line because the
          // roster already draws it — which is exactly as true when the host
          // is the one who seated it. A refusal is different: nothing on
          // screen would otherwise say why the roster did not change.
          if (!hireBot(difficulty)) {
            notify('That bot could not be seated. Try again.')
          }
        }}
        spent={budgetSpent()}
      />

      {/**
        * The one control that starts the room — across the foot of the glass on
        * a phone, under the share column on a desk.
        *
        * A sibling of the columns rather than a child of the left one, which is
        * what lets it be either. It has to escape `.columns` for two reasons:
        * that box is a query container, and a query container is the containing
        * block for anything `position: fixed` inside it; and on a phone the
        * button belongs after the roster in reading order, where a child of the
        * left column can never be.
        *
        * `data-action-dock` is what lifts the room's floating keys above it.
        */}
      <div className={styles.foot} data-action-dock="noted">
        <Button
          size="form"
          fullWidth
          blocked={!gate.ok}
          onClick={() => send({ type: 'game/started' })}
        >
          {startLabel(state)}
        </Button>
        <p className={styles.note}>Late joiners can still hop in between rounds</p>
      </div>
    </div>
  )
}
