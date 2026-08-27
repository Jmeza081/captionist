'use client'

import { Button } from '@/components/atoms/Button'
import { Icon } from '@/components/atoms/Icon'
import { Stepper } from '@/components/atoms/Stepper'
import { formatClock } from '@/components/atoms/TimerPill'
import styles from './HostToolbox.module.scss'

export interface HostToolboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Seconds on the round clock. */
  seconds: number
  onSecondsChange: (seconds: number) => void
  paused: boolean
  onTogglePause: () => void
  onSkip: () => void
  /** Label names the mode being switched *to*, so the button states an outcome. */
  onSwitchMode: () => void
  switchModeLabel: string
  onHelp: () => void
  onForceTie: () => void
  onJumpToFinal: () => void
  onRestart: () => void
  /** Left offset for the docked chat rail, so nothing sits under it. */
  railWidth?: number
}

/**
 * The host's controls, fixed bottom-right.
 *
 * Collapses to a pill FAB so it never covers the content it's controlling,
 * and offsets by the rail width per DESIGNSYSTEM.md §5.
 */
export function HostToolbox({
  open,
  onOpenChange,
  seconds,
  onSecondsChange,
  paused,
  onTogglePause,
  onSkip,
  onSwitchMode,
  switchModeLabel,
  onHelp,
  onForceTie,
  onJumpToFinal,
  onRestart,
  railWidth = 0,
}: HostToolboxProps) {
  if (!open) {
    return (
      <button
        type="button"
        className={styles.fab}
        style={{ right: `calc(${railWidth}px + var(--space-20))` }}
        onClick={() => onOpenChange(true)}
      >
        Host toolbox
      </button>
    )
  }

  return (
    <section
      className={styles.toolbox}
      style={{ right: `calc(${railWidth}px + var(--space-20))` }}
      aria-label="Host toolbox"
    >
      <header className={styles.head}>
        <span className={styles.title}>Host toolbox</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => onOpenChange(false)}
          aria-label="Close host toolbox"
        >
          <Icon name="close" size={15} />
        </button>
      </header>

      <div className={styles.body}>
        <Stepper
          label="Round timer"
          value={seconds}
          step={10}
          min={0}
          format={formatClock}
          onChange={onSecondsChange}
        />

        <hr className={styles.rule} />

        <div className={styles.pair}>
          <Button variant="secondary" size="toolbox" fullWidth onClick={onTogglePause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button size="toolbox" fullWidth onClick={onSkip}>
            Skip ahead
          </Button>
        </div>

        <hr className={styles.rule} />

        <div className={styles.pair}>
          <Button variant="secondary" size="toolbox" fullWidth onClick={onSwitchMode}>
            {switchModeLabel}
          </Button>
          <Button variant="secondary" size="toolbox" onClick={onHelp}>
            Help
          </Button>
        </div>

        <hr className={styles.rule} />

        <div className={styles.pair}>
          <Button variant="destructive" size="toolbox" fullWidth onClick={onForceTie}>
            Force a tie
          </Button>
          <Button variant="secondary" size="toolbox" fullWidth onClick={onJumpToFinal}>
            Jump to final
          </Button>
        </div>

        <Button variant="destructive" size="toolbox" fullWidth onClick={onRestart}>
          Restart game
        </Button>
      </div>
    </section>
  )
}
