'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { CloseButton } from '@/components/atoms/CloseButton'
import { Icon } from '@/components/atoms/Icon'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import { Stepper } from '@/components/atoms/Stepper'
import { formatClock } from '@/components/atoms/TimerPill'
import type { HostControls as HostAvailability } from '@/lib/game/selectors'
import { ReactionToolbar, type Reaction } from '@/components/molecules/ReactionToolbar'
import styles from './RoomToolbox.module.scss'

/** The host's own controls. Absent means this is a guest's toolbox. */
export interface HostTools {
  /** Seconds on the round clock. */
  seconds: number
  onSecondsChange: (seconds: number) => void
  paused: boolean
  onTogglePause: () => void
  onSkip: () => void
  onSwitchMode: () => void
  /** Label names the mode being switched *to*, so the button states an outcome. */
  switchModeLabel: string
  onForceTie: () => void
  onJumpToFinal: () => void
  onRestart: () => void
  /**
   * Which of these apply right now, from `hostControls(state)`.
   *
   * The engine allows every one of them in every phase and quietly no-ops most
   * of them outside a running round — so a lobby got a Pause key for a clock
   * reading 0:00 and a Force a tie with nothing to tie. The availability is the
   * room's fact, computed once beside the reducer's own rules; this component
   * only draws it.
   */
  available: HostAvailability
}

export interface RoomToolboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** One-tap reactions, in the row. The rest are behind the CTA beside them. */
  quickReactions: Reaction[]
  /** The full searchable set. */
  reactions: Reaction[]
  /** Fires a room-wide reaction. The glyph, because that is what the wire carries. */
  onReact: (glyph: string) => void
  onHelp: () => void
  /** Present for the host, absent for everyone else. */
  host?: HostTools
  /**
   * Offset for the docked chat rail, so nothing sits under it. A number is
   * treated as pixels; a string is any CSS length, which is how the room shell
   * hands over a custom property that changes at the breakpoint.
   */
  railWidth?: number | string
}

/** Matches `.reactKey`'s font size, so a picture sits where a character would. */
const KEY_GLYPH = 20

/**
 * The room's floating controls, fixed bottom-right.
 *
 * **Everyone gets one; what's inside it differs.** Reacting to the room is a
 * thing any player does, and it used to hang off the collapsed chat rail — which
 * made it look like a chat feature and put it a tap away from the composer's
 * emoji, which are not the same thing at all. It lives here now, and the host's
 * controls are simply an extra section in the same bar rather than a second,
 * host-shaped one.
 *
 * Collapses to a pill FAB so it never covers the content it's controlling, and
 * offsets by the rail width per DESIGNSYSTEM.md §5.
 */
export function RoomToolbox({
  open,
  onOpenChange,
  quickReactions,
  reactions,
  onReact,
  onHelp,
  host,
  railWidth = 0,
}: RoomToolboxProps) {
  /**
   * The full picker, expanded inside the body.
   *
   * Inside rather than over: the toolbox is already the open surface, so a
   * popover hung off it would be a second one — and DESIGNSYSTEM rule 3 allows
   * exactly one.
   */
  const [picking, setPicking] = useState(false)
  const panel = useRef<HTMLElement>(null)

  /*
    Closes on Escape, or a click anywhere outside it — the same contract the
    picker inside it has, because a floating panel that can only be dismissed by
    its own close key is the same trap twice.

    The inner picker gets first refusal: while it is open, a click outside *it*
    but inside this closes only the picker, so one click does not collapse the
    whole bar. `click` rather than `pointerdown` so the FAB can still toggle,
    and registered from an effect, which runs after the click that opened this
    has finished dispatching.
  */
  useEffect(() => {
    if (!open) return

    const dismiss = () => {
      setPicking(false)
      onOpenChange(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (picking) setPicking(false)
      else dismiss()
    }
    const onClick = (event: MouseEvent) => {
      const el = panel.current
      if (!el || !(event.target instanceof Node) || el.contains(event.target)) return
      dismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onClick)
    }
  }, [open, picking, onOpenChange])

  const railOffset = typeof railWidth === 'number' ? `${railWidth}px` : railWidth
  const label = host ? 'Host toolbox' : 'Guest toolbox'

  if (!open) {
    return (
      <button
        type="button"
        className={styles.fab}
        // `--room-dock-right` is the room's one statement of where a floating
        // key sits, so this and the collapsed chat key above it cannot drift
        // apart. The literal is the fallback for anywhere outside a room.
        style={{ right: `calc(${railOffset} + var(--room-dock-right, var(--space-20)))` }}
        onClick={() => onOpenChange(true)}
        // Named whichever shape it is in. Below `md` the label is a glyph, and
        // "Host toolbox" is still what it is.
        aria-label={label}
      >
        {/*
          A pill where there is room for one, a 44px key where there is not.
          The corner of a phone is a single column 44px wide — the collapsed
          chat key stacks directly above this — and a pill wide enough to read
          "Guest toolbox" reached back under the vote screen's lock button.
          Both are rendered and CSS shows one, the same way `ChatRail` picks
          between its two collapse glyphs.
        */}
        <span className={styles.fabLabel}>{label}</span>
        {/*
          A toolbox, not a smiley. The face is the app's *reaction*
          affordance — interaction rule 4 says so on every surface that has
          one — so the key that opened a bar of timers, skips and restarts was
          promising a reaction picker and delivering the host's controls.
        */}
        <span className={styles.fabIcon} aria-hidden="true">
          <Icon name="toolbox" size={19} />
        </span>
      </button>
    )
  }

  return (
    <section
      ref={panel}
      className={styles.toolbox}
      style={{ right: `calc(${railOffset} + var(--space-20))` }}
      aria-label={label}
    >
      <header className={styles.head}>
        <span className={styles.title}>{label}</span>
        <CloseButton
          className={styles.close}
          onClick={() => {
            setPicking(false)
            onOpenChange(false)
          }}
          label={`Close ${label.toLowerCase()}`}
        />
      </header>

      <div className={styles.body}>
        <div className={styles.section}>
          <span className={styles.eyebrow}>React to the room</span>

          <div className={styles.reactRow}>
            {quickReactions.map((r) => (
              <button
                key={r.id}
                type="button"
                className={styles.reactKey}
                // Deliberately does not close the toolbox. Reacting twice is
                // the point of reacting at all; the room's own 1.5s limit is
                // what keeps it from becoming a stream.
                onClick={() => onReact(r.glyph)}
                aria-label={`React with ${r.label}`}
              >
                <span aria-hidden="true">
                  <ReactionGlyph glyph={r.glyph} size={KEY_GLYPH} />
                </span>
              </button>
            ))}

            <ReactionCTA
              className={styles.more}
              active={picking}
              onClick={() => setPicking((was) => !was)}
            />
          </div>

          <div className={styles.pickerSlot}>
            <ReactionToolbar
              open={picking}
              title="React to the room"
              reactions={reactions}
              onPick={(reaction) => {
                onReact(reaction.glyph)
                setPicking(false)
              }}
              onDismiss={() => setPicking(false)}
            />
          </div>
        </div>

        {host && (
          <>
            <hr className={styles.rule} />

            <Stepper
              label="Round timer"
              value={host.seconds}
              step={10}
              min={0}
              format={formatClock}
              onChange={host.onSecondsChange}
              blocked={!host.available.clock}
            />

            <hr className={styles.rule} />

            <div className={styles.pair}>
              <Button
                variant="secondary"
                size="toolbox"
                fullWidth
                blocked={!host.available.clock}
                onClick={host.onTogglePause}
              >
                {host.paused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                size="toolbox"
                fullWidth
                blocked={!host.available.skip}
                onClick={host.onSkip}
              >
                Skip ahead
              </Button>
            </div>

            <div className={styles.pair}>
              <Button
                variant="secondary"
                size="toolbox"
                fullWidth
                onClick={host.onSwitchMode}
              >
                {host.switchModeLabel}
              </Button>
            </div>
          </>
        )}

        <hr className={styles.rule} />

        <Button variant="secondary" size="toolbox" fullWidth onClick={onHelp}>
          How this works
        </Button>

        {host && (
          <>
            <hr className={styles.rule} />

            <div className={styles.pair}>
              <Button
                variant="destructive"
                size="toolbox"
                fullWidth
                blocked={!host.available.forceTie}
                onClick={host.onForceTie}
              >
                Force a tie
              </Button>
              <Button
                variant="secondary"
                size="toolbox"
                fullWidth
                blocked={!host.available.jumpToFinal}
                onClick={host.onJumpToFinal}
              >
                Jump to final
              </Button>
            </div>

            <Button
              variant="destructive"
              size="toolbox"
              fullWidth
              blocked={!host.available.restart}
              onClick={host.onRestart}
            >
              Restart game
            </Button>

            {/* One line for the whole group rather than a label per key.
                ADR 0032: a blocked label carries a count the screen cannot
                otherwise show, and "there is no round yet" is not a count —
                it is one fact about the room that six controls share. */}
            {host.available.note && <p className={styles.note}>{host.available.note}</p>}
          </>
        )}
      </div>
    </section>
  )
}
