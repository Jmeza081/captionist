'use client'

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { ProgressRail } from '@/components/atoms/ProgressRail'
import { Snackbar } from '@/components/atoms/Snackbar'
import { TimerPill, URGENT_AT } from '@/components/atoms/TimerPill'
import { AppHeader } from '@/components/molecules/AppHeader'
import { ChatRail } from '@/components/molecules/ChatRail'
import { HostToolbox } from '@/components/molecules/HostToolbox'
import { Modal } from '@/components/molecules/Modal'
import { RoundOpener } from '@/components/molecules/RoundOpener'
import { PhasePending } from '@/components/organisms/PhasePending'
import {
  isUrgent,
  modeName,
  phaseLabel,
  roleHolder,
  settingsLine,
  showsProgressRail,
  timerSuffix,
  toAvatarProps,
} from '@/lib/game/selectors'
import type { RoomPhase } from '@/lib/game/types'
import { useCountdown } from '@/lib/room/useCountdown'
import { useRoom, useRoomRefusal } from '@/lib/room/useRoom'
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

/** Which overlays are mutually exclusive. Chat is not one: it docks. */
type Overlay = 'toolbox' | 'help' | null

export interface RoomShellProps {
  /** The phase-to-screen map. Injected so the shell has no opinion about screens. */
  screens?: Partial<Record<RoomPhase, ComponentType>>
}

export function RoomShell({ screens = {} }: RoomShellProps) {
  const { state, status, selfId, isHost, send } = useRoom()
  const countdown = useCountdown(state?.clock)

  const [chatOpen, setChatOpen] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)
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

  const holder = state ? roleHolder(state) : undefined
  const opener = state && holder ? openerCopy(state, selfId) : undefined

  // Nothing renders behind the round opener: its interstitial covers the
  // screen, and a stand-in underneath would be a screen nobody can see
  // announcing itself.
  const Screen =
    !state || state.phase === 'opener' ? undefined : (screens[state.phase] ?? PhasePending)

  const urgent = Boolean(state && (isUrgent(state) || countdown.seconds <= URGENT_AT))
  const showRail = Boolean(state && showsProgressRail(state) && countdown.running)

  const shellApi = useMemo<RoomShellApi>(() => ({ notify }), [notify])

  const toolbox = useMemo(
    () => ({
      onSecondsChange: (seconds: number) =>
        send({ type: 'host/adjustedClock', deltaMs: (seconds - countdown.seconds) * 1_000 }),
      onTogglePause: () => send({ type: countdown.paused ? 'host/resumed' : 'host/paused' }),
    }),
    [send, countdown.seconds, countdown.paused],
  )

  // SSR and the moment before the first broadcast. The chrome renders so the
  // page has shape; nothing below may read `state`.
  if (!state) {
    return (
      <div className={styles.shell}>
        <AppHeader />
        <p className={styles.connecting}>
          {status === 'disconnected' ? 'Lost the room. Reconnecting…' : 'Joining the room…'}
        </p>
      </div>
    )
  }

  const otherMode = state.settings.mode === 'caption' ? 'react' : 'caption'

  return (
    <div
      className={[styles.shell, chatOpen ? styles.railOpen : '', isHost ? styles.hasToolbox : '']
        .filter(Boolean)
        .join(' ')}
    >
      <AppHeader
        phase={phaseLabel(state, selfId)}
        settings={settingsLine(state)}
        host={isHost}
        surface={state.phase === 'vote' ? 'vote' : 'default'}
        trailing={
          countdown.running || countdown.paused ? (
            <TimerPill
              seconds={countdown.seconds}
              suffix={timerSuffix(state, selfId)}
              urgent={urgent}
            />
          ) : undefined
        }
      />

      {showRail && <ProgressRail fraction={countdown.fraction} urgent={urgent} />}

      <div className={styles.body}>
        <main className={styles.content} data-phase={state.phase}>
          <RoomShellContext.Provider value={shellApi}>
            {Screen && <Screen />}
          </RoomShellContext.Provider>
        </main>

        {/* A phone cannot afford a docked rail — the design turns chat into a
            sheet there instead, which lands with chat itself in phase 6. Until
            then the rail simply is not rendered below the breakpoint, and
            `--room-rail-width` stays 0 so nothing offsets by a rail that
            isn't there. */}
        <div className={styles.rail}>
          <ChatRail
            open={chatOpen}
            onOpenChange={setChatOpen}
            present={state.players.length}
            players={state.players.map(toAvatarProps)}
          >
            {/* Chat itself lands in phase 6. The rail is here now because every
                screen has to lay out around it from the start. */}
            <p className={styles.railEmpty}>Chat opens up in a later round of work.</p>
          </ChatRail>
        </div>
      </div>

      {isHost && (
        <HostToolbox
          open={overlay === 'toolbox'}
          onOpenChange={(open) => setOverlay(open ? 'toolbox' : null)}
          seconds={countdown.seconds}
          onSecondsChange={toolbox.onSecondsChange}
          paused={countdown.paused}
          onTogglePause={toolbox.onTogglePause}
          onSkip={() => send({ type: 'host/skippedPhase' })}
          onSwitchMode={() => {
            send({ type: 'host/switchedMode', mode: otherMode })
            notify(`Mode set to ${modeName(otherMode)}`)
          }}
          switchModeLabel={otherMode === 'react' ? 'Switch to prompts' : 'Switch to captions'}
          onHelp={() => {
            setHelpStep(0)
            setOverlay('help')
          }}
          onForceTie={() => send({ type: 'host/forcedTie' })}
          onJumpToFinal={() => send({ type: 'host/jumpedToPodium' })}
          onRestart={() => send({ type: 'host/restarted' })}
          railWidth="var(--room-rail-width)"
        />
      )}

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

      {queue[0] && (
        <div className={styles.snackbarDock}>
          <Snackbar message={queue[0]} />
        </div>
      )}
    </div>
  )
}
