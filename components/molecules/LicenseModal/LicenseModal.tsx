'use client'

import { useState } from 'react'
import { Modal } from '@/components/molecules/Modal'
import { LICENSE_STEPS } from './steps'

export interface LicenseModalProps {
  open: boolean
  onClose: () => void
}

/**
 * "What this is built on" — the four licences a production deploy carries.
 *
 * A configured `Modal`, the same shape as `HelpModal`: the walkthrough is a
 * thing the product has rather than a thing a page assembles. It holds nothing
 * but which step you are reading, has no rail, and knows nothing about a room —
 * which is what lets the public landing page be the one that opens it.
 *
 * **Why the landing page and not a `/legal` route.** Three of the four are
 * attribution rather than a contract: CC BY asks for credit where the art is,
 * CC0 asks for nothing, and the provider marks are already on the picker where
 * the GIFs are. What was actually missing was one place a person can read all
 * of it before they play, and a page nobody visits is not that place.
 */
export function LicenseModal({ open, onClose }: LicenseModalProps) {
  // Remounted per opening, so every visit starts at step one — the same gate
  // `HelpModal` uses, and for the same reason.
  if (!open) return null
  return <Walkthrough onClose={onClose} />
}

function Walkthrough({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)

  return (
    <Modal
      open
      onClose={onClose}
      label="Licensing and credits"
      steps={LICENSE_STEPS}
      stepIndex={step}
      onStepChange={setStep}
    />
  )
}
