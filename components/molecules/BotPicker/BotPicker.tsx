'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { CloseButton } from '@/components/atoms/CloseButton'
import { Stack } from '@/components/atoms/Stack'
import { ModeCard } from '@/components/molecules/ModeCard'
import { budgetReport } from '@/lib/bots/budget'
import { BOT_DIFFICULTIES, type BotDifficulty } from '@/lib/bots/types'
import { DEFAULT_DIFFICULTY, personaFor } from '@/lib/bots/personas'
import styles from './BotPicker.module.scss'

export interface BotPickerProps {
  open: boolean
  onClose: () => void
  /** Seats the bot. The screen closes the picker; this only hires. */
  onHire: (difficulty: BotDifficulty) => void
  /** True once the room has spent its model budget. Changes what is promised, never whether hiring works. */
  spent?: boolean
}

/**
 * Choose how ruthless a bot is, then hire it.
 *
 * **Not a configured `Modal`.** That one is a paged walkthrough whose footer is
 * dots plus Back/Next — a caller cannot replace it, and "pick a level and
 * confirm" is a form, not a narrative. Growing `Modal` a second footer would
 * hand every other caller a mode they never use.
 *
 * The levels are `ModeCard`s in a radiogroup for the reason `ModeCard` exists
 * at all: each one needs a sentence to be a choice rather than a label, which
 * is what a `SegmentedControl` cannot carry.
 *
 * **Render this as a sibling of a query container, never inside one.** A
 * container establishes the containing block for `position: fixed`, so a
 * backdrop nested in the lobby's `.columns` would be trapped inside the column
 * rather than covering the screen. `HostSetupScreen` documents the same trap.
 */
export function BotPicker({ open, onClose, onHire, spent = false }: BotPickerProps) {
  const [choice, setChoice] = useState<BotDifficulty>(DEFAULT_DIFFICULTY)
  const cardRef = useRef<HTMLDivElement>(null)

  // Focus moves in and Escape closes — the pair `Modal` implements, kept
  // rather than inherited because this is not a `Modal`.
  useEffect(() => {
    if (!open) return
    cardRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Gated after the hooks, not before: an early return above them is the
  // classic way a component starts breaking the rules of hooks quietly.
  if (!open) return null

  const budget = budgetReport()
  const persona = personaFor(choice)

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Hire a bot"
        className={styles.card}
        data-testid="bot-picker"
      >
        <Stack gap={14}>
          <div className={styles.meter}>
            <div className={styles.meterTop}>
              <span>Bot budget</span>
              <span data-testid="bot-budget">
                {spent ? 'Spent for this month' : `$${budget.spentUsd.toFixed(2)} of $${budget.budgetUsd.toFixed(2)}`}
              </span>
            </div>
            <div className={`${styles.bar} ${spent ? styles.barOut : ''}`}>
              <span style={{ width: `${Math.round(budget.fraction * 100)}%` }} />
            </div>
          </div>

          <div className={styles.head}>
            <h2 className={styles.heading}>Hire a bot</h2>
            <CloseButton onClick={onClose} label="Close bot picker" />
          </div>

          <p className={styles.blurb}>
            {spent
              ? 'Bot budget spent for this month. New bots will use written-in jokes until it resets.'
              : 'It plays a full game — picks GIFs, writes captions, votes.'}
          </p>

          <div role="radiogroup" aria-label="How ruthless" className={styles.levels}>
            {BOT_DIFFICULTIES.map((id) => {
              const level = personaFor(id)
              return (
                <ModeCard
                  key={id}
                  title={level.label}
                  body={level.blurb}
                  tag={choice === id ? 'Selected' : level.tag}
                  selected={choice === id}
                  onSelect={() => setChoice(id)}
                />
              )
            })}
          </div>

          <Button
            size="form"
            fullWidth
            onClick={() => {
              onHire(choice)
              onClose()
            }}
          >
            {/* Live even when the budget is spent. A budget is not a reason to
                refuse something the room can still do — it is a reason to have
                already said what you will get. */}
            {spent ? `Hire ${persona.label} anyway` : `Hire ${persona.label}`}
          </Button>
        </Stack>
      </div>
    </div>
  )
}
