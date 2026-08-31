'use client'

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { Button } from '@/components/atoms/Button'
import { Icon } from '@/components/atoms/Icon'
import styles from './Modal.module.scss'

export interface ModalStep {
  /** Small accent marker above the heading — "The writing". */
  eyebrow: string
  heading: string
  body: string
  /**
   * Fills the 380px rail, edge to edge.
   *
   * A node rather than a `src`, because the design's rail is a miniature of
   * the screen the step describes — an image wearing its "Selected" pill, a
   * vote grid mid-ranking — and only some of those are a picture at all.
   */
  illustration?: ReactNode
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** Names the dialog for assistive tech. */
  label: string
  steps: ModalStep[]
  /** Zero-based. */
  stepIndex: number
  onStepChange: (index: number) => void
  /** Rendered in the header beside the step count — e.g. a mode switcher. */
  headerControl?: ReactNode
  /** Disconnect and error modals swap the purple glow for red. */
  tone?: 'default' | 'error'
}

/**
 * The multi-step walkthrough — house rules, disconnects, errors.
 *
 * Back and Next stay grouped as a pair on the right, never spread apart, so
 * the eye doesn't have to cross the card to advance.
 *
 * Three ways out, because a walkthrough nobody asked for must not feel like a
 * trap: the close key, Escape, and a click on the backdrop.
 */
export function Modal({
  open,
  onClose,
  label,
  steps,
  stepIndex,
  onStepChange,
  headerControl,
  tone = 'default',
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  /**
   * Whether the press that started this click landed on the backdrop.
   *
   * A `click` fires on the common ancestor of its press and release, so a
   * selection drag that starts on the copy and ends past the card's edge
   * targets the backdrop too. Without this, reading the modal with a mouse
   * closes it.
   */
  const pressedOutside = useRef(false)
  // Escape closes, and focus moves into the card so a keyboard user isn't
  // left behind the backdrop.
  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)
    cardRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const step = steps[stepIndex]
  if (!step) return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1

  function onBackdropMouseDown(e: MouseEvent<HTMLDivElement>) {
    pressedOutside.current = e.target === e.currentTarget
  }

  function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (pressedOutside.current && e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={onBackdropMouseDown}
      onClick={onBackdropClick}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`${styles.card} ${tone === 'error' ? styles.error : ''}`}
      >
        <div className={styles.copy}>
          <div className={styles.head}>
            {/* A one-step modal is an announcement, not a walkthrough, and
                "Step 1 of 1" reads as a counter that forgot to count. */}
            <span className={styles.stepCount}>
              {steps.length > 1 ? `Step ${stepIndex + 1} of ${steps.length}` : ''}
            </span>
            {headerControl && <div className={styles.control}>{headerControl}</div>}
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <span className={styles.eyebrow}>{step.eyebrow}</span>
          <h2 className={styles.heading}>{step.heading}</h2>
          <p className={styles.body}>{step.body}</p>

          <div className={styles.foot}>
            <div className={styles.dots} aria-hidden="true">
              {steps.map((s, i) => (
                <span
                  key={s.heading}
                  className={`${styles.dot} ${i === stepIndex ? styles.dotActive : ''}`}
                />
              ))}
            </div>

            <div className={styles.nav}>
              <Button
                variant="secondary"
                size="inline"
                onClick={() => onStepChange(stepIndex - 1)}
                disabled={isFirst}
              >
                Back
              </Button>
              <Button
                size="inline"
                onClick={() => (isLast ? onClose() : onStepChange(stepIndex + 1))}
              >
                {isLast ? 'Got it' : 'Next'}
              </Button>
            </div>
          </div>
        </div>

        {step.illustration && (
          <div className={styles.rail} data-testid="modal-rail">
            {step.illustration}
          </div>
        )}
      </div>
    </div>
  )
}
