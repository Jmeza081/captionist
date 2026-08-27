'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/atoms/Button'
import { Icon } from '@/components/atoms/Icon'
import styles from './Modal.module.scss'

export interface ModalStep {
  /** Small accent marker above the heading — "The writing". */
  eyebrow: string
  heading: string
  body: string
  /** Optional media for the 300px right rail. */
  media?: { src: string; alt: string }
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

  return (
    <div className={styles.backdrop}>
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
            <span className={styles.stepCount}>
              Step {stepIndex + 1} of {steps.length}
            </span>
            {headerControl}
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

        {step.media && (
          <div className={styles.rail}>
            {/* eslint-disable-next-line @next/next/no-img-element -- animated
                GIF; next/image would rasterise it. */}
            <img src={step.media.src} alt={step.media.alt} />
          </div>
        )}
      </div>
    </div>
  )
}
