'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { Modal } from '@/components/molecules/Modal'
import type { GameMode } from '@/lib/game/types'
import { HELP_MODES, HELP_STEPS } from './steps'

export interface HelpModalProps {
  open: boolean
  onClose: () => void
  /**
   * The format this room is set to.
   *
   * It is what the walkthrough opens on, and it carries the dot in the
   * switcher. Omitted where no format has been chosen yet — the landing page —
   * in which case the walkthrough opens on captions and nothing is marked.
   */
  mode?: GameMode
}

/**
 * "How Captionist works", wherever it is opened from.
 *
 * A configured `Modal` rather than four call sites each assembling the same
 * one: the landing nav, the host's setup screen, the lobby's help key and the
 * room toolbox all show this, and the walkthrough is a thing the product has
 * rather than a thing each screen writes.
 *
 * The switcher explains the *other* format without changing the room — reading
 * is not a setting — so the mode lives here and the room's own mode only
 * arrives as the starting point and the green dot. Switching restarts at step
 * one, because step 2 of captions is not step 2 of prompts.
 *
 * A molecule that holds a molecule, like `RoomToolbox`: it composes `Modal`,
 * holds nothing but which step and which format you are reading, and knows
 * nothing about a room. Were it to reach for `useRoom()` it would belong a
 * tier up, and the landing page could no longer show it.
 */
export function HelpModal({ open, onClose, mode }: HelpModalProps) {
  // A gate rather than a prop passed down: every opening starts at step one on
  // the format in play, and remounting is how you say that without an effect
  // that resets state after the fact.
  if (!open) return null
  return <Walkthrough onClose={onClose} roomMode={mode} />
}

function Walkthrough({
  onClose,
  roomMode,
}: {
  onClose: () => void
  roomMode?: GameMode
}) {
  const [mode, setMode] = useState<GameMode>(roomMode ?? 'caption')
  const [step, setStep] = useState(0)

  return (
    <Modal
      open
      onClose={onClose}
      label="How Captionist works"
      steps={HELP_STEPS[mode]}
      stepIndex={step}
      onStepChange={setStep}
      headerControl={
        <SegmentedControl
          label="Which format to explain"
          value={mode}
          onChange={(next) => {
            setMode(next)
            setStep(0)
          }}
          options={HELP_MODES.map((option) => ({
            ...option,
            marked: option.value === roomMode,
          }))}
        />
      }
    />
  )
}
