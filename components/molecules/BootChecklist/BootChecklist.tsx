import { Icon } from '@/components/atoms/Icon'
import { ProgressRing } from '@/components/atoms/ProgressRing'
import styles from './BootChecklist.module.scss'

/** Where a step is. `failed` is the one the boot stopped on. */
export type BootStepState = 'pending' | 'active' | 'done' | 'failed'

export interface BootStep {
  /** What the room is doing — "Finding the room". */
  label: string
  state: BootStepState
}

export interface BootChecklistProps {
  steps: readonly BootStep[]
}

/** What assistive tech hears instead of a ring, a check or a dot. */
const STATE_LABEL: Record<BootStepState, string> = {
  pending: 'Not started',
  active: 'In progress',
  done: 'Done',
  failed: 'Stopped',
}

/**
 * The steps a room takes to open, and which one it is on.
 *
 * Every row is a milestone that actually resolves — the boot reports where it
 * is, and nothing here invents a stage to fill the wait. See `bootTimeline`,
 * which is what stops a fast transport flicking through all three before
 * anyone reads them.
 *
 * Not `StatusPill`: that one carries a sentence about the room to everyone in
 * it. This is a private list of four states with an active-row plate, and the
 * two would have shared a name and no behaviour.
 *
 * An ordered list, because the order is the meaning. The active row is
 * announced politely rather than assertively: the room is working, which is
 * worth hearing about but never worth interrupting for.
 */
export function BootChecklist({ steps }: BootChecklistProps) {
  return (
    <ol className={styles.list}>
      {steps.map((step) => (
        <li
          key={step.label}
          className={`${styles.step} ${styles[step.state]}`}
          aria-live={step.state === 'active' ? 'polite' : undefined}
        >
          <span className={styles.marker}>
            {step.state === 'done' && <Icon name="check" size={12} color="var(--boot-check)" />}
            {step.state === 'active' && <ProgressRing size="inline" />}
            {step.state === 'failed' && <Icon name="close" size={12} color="var(--boot-fail)" />}
            {step.state === 'pending' && <span className={styles.dot} />}
          </span>
          <span className={styles.label}>{step.label}</span>
          <span className={styles.srOnly}>{` — ${STATE_LABEL[step.state]}`}</span>
        </li>
      ))}
    </ol>
  )
}
