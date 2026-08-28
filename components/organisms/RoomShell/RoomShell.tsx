'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { ProgressRail } from '@/components/atoms/ProgressRail'
import { RoundProgress } from '@/components/atoms/RoundProgress'
import { Snackbar } from '@/components/atoms/Snackbar'
import { TimerPill, URGENT_AT } from '@/components/atoms/TimerPill'
import { AppHeader } from '@/components/molecules/AppHeader'
import { ChatRail } from '@/components/molecules/ChatRail'
import { ChatToast, ChatToastOverflow } from '@/components/molecules/ChatToast'
import { ReactionFloaters } from '@/components/molecules/ReactionFloaters'
import { RoomToolbox } from '@/components/molecules/RoomToolbox'
import { Modal } from '@/components/molecules/Modal'
import { ReconnectOverlay } from '@/components/molecules/ReconnectOverlay'
import { RoundOpener } from '@/components/molecules/RoundOpener'
import { ChatPanel } from '@/components/organisms/ChatPanel'
import {
  isUrgent,
  modeName,
  phaseLabel,
  playerById,
  presentCount,
  reconnectCopy,
  roleHolder,
  settingsLine,
  showsProgressRail,
  showsRoundProgress,
  timerSuffix,
  toAvatarProps,
} from '@/lib/game/selectors'
import { SEAT_GRACE_MS } from '@/lib/game/constants'
import type { Clock, RoomPhase } from '@/lib/game/types'
import { QUICK_REACTIONS, REACTIONS } from '@/lib/reactions'
import type { ChatQuote } from '@/lib/room/transport'
import { ROOM_TARGET } from '@/lib/room/transport'
import { useCountdown } from '@/lib/room/useCountdown'
import {
  useChat,
  useChatLog,
  useLastReaction,
  useRoom,
  useRoomRefusal,
  useUnread,
} from '@/lib/room/useRoom'
import { RoomShellContext, type RoomShellApi } from './context'
import { HELP_STEPS, openerCopy } from './copy'
import styles from './RoomShell.module.scss'

/**
 * The chrome every in-room screen sits inside.
 *
 * It owns the four things that are the *room's* rather than any one screen's:
 * the header and its clock, the docked rail, the host's controls, and the
 * single snackbar. A screen owns its content column and nothing else, which is
 * what keeps ten screens from each growing their own header.
 *
 * One `useRoom()` call and one interval serve the whole page.
 */

/** DESIGNSYSTEM.md §3 — one snackbar at a time, gone in 2.8s. */
const SNACKBAR_MS = 2_800

/** How long an incoming message sits beside the collapsed rail. */
const TOAST_MS = 5_200

/**
 * How many toasts stack before the rest become a count.
 *
 * Three would already reach the timer on a short phone, and the thing a toast
 * must never do is hide the clock it is competing with.
 */
const TOAST_LIMIT = 2

/**
 * Which overlays are mutually exclusive. Chat is not one: it docks.
 *
 * The room's reaction picker used to be a third member, hung off the collapsed
 * rail. It is inside the toolbox now — see `RoomToolbox` — so it is part of
 * that surface rather than competing with it, and rule 3 ("one overlay surface
 * at a time") still holds with one fewer thing to remember.
 */
type Overlay = 'toolbox' | 'help' | null

export interface RoomShellProps {
  /** The phase-to-screen map. Injected so the shell has no opinion about screens. */
  screens?: Partial<Record<RoomPhase, ComponentType>>
}

export function RoomShell({ screens = {} }: RoomShellProps) {
  const router = useRouter()
  const { state, status, error, selfId, isHost, send } = useRoom()
  const countdown = useCountdown(state?.clock)

  // The held seat is a deadline like any other, so it gets the same clock the
  // round does — which is also what keeps `Date.now()` out of the render path.
  const heldUntil = state ? playerById(state, selfId)?.seatHeldUntil : undefined
  const graceClock = useMemo<Clock | undefined>(
    () =>
      heldUntil === undefined
        ? undefined
        : { status: 'running', endsAt: heldUntil, totalMs: SEAT_GRACE_MS },
    [heldUntil],
  )
  const grace = useCountdown(graceClock)

  const [chatOpen, setChatOpen] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const messages = useChatLog()
  const unread = useUnread()
  const { markRead, react } = useChat()
  const burst = useLastReaction()
  const [helpStep, setHelpStep] = useState(0)
  const [queue, setQueue] = useState<readonly string[]>([])

  const notify = useCallback((message: string) => {
    setQueue((q) => [...q, message])
  }, [])

  // The room's own refusals are already finished sentences — see `authorize`.
  useRoomRefusal(notify)

  useEffect(() => {
    if (queue.length === 0) return
    const id = setTimeout(() => setQueue((q) => q.slice(1)), SNACKBAR_MS)
    return () => clearTimeout(id)
  }, [queue])

  // Opening chat is what marks it read — not scrolling, and not the passage of
  // time. The unread run is also what draws the divider, so clearing it on any
  // looser trigger would erase the line you came back to find.
  useEffect(() => {
    if (chatOpen) markRead()
  }, [chatOpen, messages.length, markRead])

  // Toasts are the collapsed rail's only voice, so they exist only while it is
  // collapsed and expire on their own. Keyed on the newest message's id rather
  // than a timer per toast: one timeout, restarted, cannot leak.
  const [toastFloor, setToastFloor] = useState(0)
  const newestId = messages[messages.length - 1]?.id
  useEffect(() => {
    if (chatOpen || newestId === undefined) return
    const id = setTimeout(() => setToastFloor(messages.length), TOAST_MS)
    return () => clearTimeout(id)
  }, [chatOpen, newestId, messages.length])

  // Everything since you last looked, minus whatever has already timed out.
  const pending = messages.slice(Math.max(toastFloor, messages.length - unread.count))

  const holder = state ? roleHolder(state) : undefined
  const opener = state && holder ? openerCopy(state, selfId) : undefined

  // Nothing renders behind the round opener: its interstitial covers the
  // screen, and a stand-in underneath would be a screen nobody can see
  // announcing itself. Every other phase has a real screen now, so an absent
  // entry means the map is wrong rather than the work is unfinished.
  const Screen = !state || state.phase === 'opener' ? undefined : screens[state.phase]

  const urgent = Boolean(state && (isUrgent(state) || countdown.seconds <= URGENT_AT))
  const showRail = Boolean(state && showsProgressRail(state) && countdown.running)

  const openHelp = useCallback(() => {
    setHelpStep(0)
    setOverlay('help')
  }, [])

  const [replyTo, setReplyTo] = useState<ChatQuote | undefined>(undefined)

  /**
   * Staging a reply opens chat, because the answer has nowhere else to go —
   * and on a phone the rail is a sheet, so this is what puts the composer in
   * front of you rather than leaving a quote staged behind a closed rail.
   */
  const startReply = useCallback((quote: ChatQuote) => {
    setReplyTo(quote)
    setChatOpen(true)
  }, [])
  const clearReply = useCallback(() => setReplyTo(undefined), [])

  const shellApi = useMemo<RoomShellApi>(
    () => ({ notify, openHelp, replyTo, startReply, clearReply }),
    [notify, openHelp, replyTo, startReply, clearReply],
  )

  /**
   * The burst, by value.
   *
   * Built once per reaction rather than once per render. Inline, this was a new
   * object on every clock tick, which restarted the floaters' effect several
   * times a second — see `ReactionFloaters`, where the other half of that bug
   * lived.
   */
  const floaterBurst = useMemo(
    () => (burst ? { glyph: burst.emoji, key: burst.key } : null),
    [burst],
  )

  const reactToRoom = useCallback(
    (glyph: string) => react('room', ROOM_TARGET, glyph),
    [react],
  )

  // SSR and the moment before the first broadcast. The chrome renders so the
  // page has shape; nothing below may read `state`.
  if (!state) {
    return (
      <div className={styles.shell}>
        <AppHeader />
        <p className={styles.connecting}>
          {error ??
            (status === 'disconnected'
              ? 'Lost the room. Reconnecting…'
              : 'Joining the room…')}
        </p>
      </div>
    )
  }

  const otherMode = state.settings.mode === 'caption' ? 'react' : 'caption'

  // A drop the player can see, rather than one only the transport knows about.
  // The old copy sat behind `if (!state)`, so it only ever fired for someone
  // who never connected — never for the case it describes.
  const dropped = status === 'disconnected'
  const me = playerById(state, selfId)
  const held = graceClock !== undefined
  const dropCopy = reconnectCopy(state, selfId, grace.seconds, held)

  return (
    <div
      className={[
        styles.shell,
        chatOpen ? styles.railOpen : '',
        // Everyone has a toolbox now, so everyone's content column reserves
        // room for it and everyone's collapsed chat key stacks above it.
        styles.hasToolbox,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AppHeader
        phase={phaseLabel(state, selfId)}
        settings={settingsLine(state)}
        host={isHost}
        surface={state.phase === 'vote' ? 'vote' : 'default'}
        trailing={
          // The pips and the clock are the same slot: the scoreboard is untimed
          // and the timed phases have no rounds-played to report, so the two
          // never contend.
          showsRoundProgress(state) ? (
            <RoundProgress
              played={state.roundNumber}
              total={state.settings.totalRounds}
              showLabel
            />
          ) : countdown.running || countdown.paused ? (
            <TimerPill
              seconds={countdown.seconds}
              suffix={timerSuffix(state, selfId)}
              urgent={urgent}
            />
          ) : undefined
        }
      />

      {showRail && <ProgressRail fraction={countdown.fraction} urgent={urgent} />}

      {/* The provider wraps the rail as well as the content column, because a
          reply is raised on a vote card and consumed in the composer — the one
          thing in this contract that crosses between them. */}
      <RoomShellContext.Provider value={shellApi}>
        <div className={styles.body}>
          <main className={styles.content} data-phase={state.phase}>
            {Screen && <Screen />}
          </main>

          {/* One rail at both sizes. Below `md` it renders as a sheet over the
            content and `--room-rail-width` stays 0, because a sheet overlays
            rather than displaces; from `md` up it docks and the column
            reflows around it. The branch is entirely in the rail's own
            stylesheet — see `ChatRail.module.scss`. */}
          <div className={styles.rail}>
            <ChatRail
              open={chatOpen}
              onOpenChange={setChatOpen}
              present={presentCount(state)}
              unread={unread.count}
              players={state.players.map(toAvatarProps)}
              toasts={
                pending.length > 0 ? (
                  <>
                    {pending.slice(-TOAST_LIMIT).map((entry) => {
                      const author = playerById(state, entry.from)
                      return (
                        <ChatToast
                          key={entry.id}
                          author={
                            author
                              ? toAvatarProps(author)
                              : {
                                  name: 'Someone who left',
                                  color: '#303031',
                                  avatarSeed: entry.from,
                                }
                          }
                          body={entry.text}
                        />
                      )
                    })}
                    {pending.length > TOAST_LIMIT && (
                      <ChatToastOverflow count={pending.length - TOAST_LIMIT} />
                    )}
                  </>
                ) : undefined
              }
            >
              <ChatPanel />
            </ChatRail>
          </div>
        </div>
      </RoomShellContext.Provider>

      {/* Everyone has one — a guest's holds the room's reactions and the
          walkthrough, a host's adds their controls to the same bar. The phone's
          chat sheet covers the content and this floats over everything,
          including the sheet's own send button, so while chat is open on a
          phone it stands down; closing chat brings it back. Above `md` the rail
          docks beside the content and the two never contend. */}
      <div className={styles.toolboxDock}>
        <RoomToolbox
          open={overlay === 'toolbox'}
          /*
            Closing only closes *this*. The toolbox's own click-outside
            dismissal fires after React has handled the same click, so a tap on
            its "How this works" key would open the modal and then have this
            put it straight back down.
          */
          onOpenChange={(open) =>
            setOverlay((cur) => (open ? 'toolbox' : cur === 'toolbox' ? null : cur))
          }
          quickReactions={[...QUICK_REACTIONS]}
          reactions={[...REACTIONS]}
          onReact={reactToRoom}
          onHelp={openHelp}
          host={
            isHost
              ? {
                  seconds: countdown.seconds,
                  onSecondsChange: (seconds: number) =>
                    send({
                      type: 'host/adjustedClock',
                      deltaMs: (seconds - countdown.seconds) * 1_000,
                    }),
                  paused: countdown.paused,
                  onTogglePause: () =>
                    send({ type: countdown.paused ? 'host/resumed' : 'host/paused' }),
                  onSkip: () => send({ type: 'host/skippedPhase' }),
                  onSwitchMode: () => {
                    send({ type: 'host/switchedMode', mode: otherMode })
                    notify(`Mode set to ${modeName(otherMode)}`)
                  },
                  switchModeLabel:
                    otherMode === 'react' ? 'Switch to prompts' : 'Switch to captions',
                  onForceTie: () => send({ type: 'host/forcedTie' }),
                  onJumpToFinal: () => send({ type: 'host/jumpedToPodium' }),
                  onRestart: () => send({ type: 'host/restarted' }),
                }
              : undefined
          }
          railWidth="var(--room-rail-width)"
        />
      </div>

      {/* Never pauses the room — only the host's own pause stops the clock. */}
      <Modal
        open={overlay === 'help'}
        onClose={() => setOverlay(null)}
        label="How Captionist works"
        steps={HELP_STEPS[state.settings.mode]}
        stepIndex={helpStep}
        onStepChange={setHelpStep}
      />

      {state.phase === 'opener' && opener && holder && (
        <div className={styles.interstitial}>
          <RoundOpener
            round={state.roundNumber}
            totalRounds={state.settings.totalRounds}
            mode={state.settings.mode}
            headline={opener.headline}
            subline={opener.subline}
            roleHolder={toAvatarProps(holder)}
            // `host/skippedPhase` is host-only, so offering it to a guest would
            // produce a refusal snackbar rather than an action.
            onSkip={isHost ? () => send({ type: 'host/skippedPhase' }) : undefined}
          />
        </div>
      )}

      {/* The room is still mounted behind this — `GuestClient` holds the last
          state it saw, so the blur is over something real. Rendered here rather
          than from a screen because a drop is the room's business, not the
          phase's, and it has to survive whichever screen is up. */}
      {dropped && (
        <ReconnectOverlay
          headline={dropCopy.headline}
          body={dropCopy.body}
          attempt={dropCopy.attempt}
          countdown={dropCopy.countdown}
          identity={dropCopy.identity}
          where={dropCopy.where}
          fraction={held ? grace.fraction : undefined}
          player={me ? toAvatarProps(me) : undefined}
          // The transport is already retrying; this is the impatient path, and
          // a full reload is the honest one — it re-runs the claim, reclaims
          // the seat from `sessionStorage`, and rebuilds the connection.
          onRejoin={() => window.location.reload()}
          onLeave={() => router.push('/')}
        />
      )}

      {/* Anybody's reaction, anywhere in the room. Purely decorative — the
          count on the card is the information, and this is the noise the room
          makes when it lands. */}
      <div className={styles.floaterDock}>
        <ReactionFloaters burst={floaterBurst} />
      </div>

      {queue[0] && (
        <div className={styles.snackbarDock}>
          <Snackbar message={queue[0]} />
        </div>
      )}
    </div>
  )
}
