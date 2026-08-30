import { Avatar } from '@/components/atoms/Avatar'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Logo } from '@/components/atoms/Logo'
import { ProgressRail } from '@/components/atoms/ProgressRail'
import { ProgressRing } from '@/components/atoms/ProgressRing'
import { RoomCode } from '@/components/atoms/RoomCode'
import { Stack } from '@/components/atoms/Stack'
import { Wordmark } from '@/components/molecules/Wordmark'
import { BootChecklist, type BootStepState } from '@/components/molecules/BootChecklist'
import type { BootProgress } from '@/lib/room/store'
import { BOOT_FOOTNOTE, BOOT_STEPS, BOOT_TITLE, CODE_LABEL } from './copy'
import styles from './RoomBootScreen.module.scss'
import type { PlayerFace } from '@/lib/game/types'

export interface RoomBootScreenProps {
  /**
   * Which room is opening. One prop, branching values — a host and a guest
   * wait on the same three questions and see the same card; what differs is
   * the copy, the badge, and where Cancel goes.
   */
  variant: BootProgress['role']
  code: string
  /** One per row, already paced by `useBootTimeline`. */
  states: readonly BootStepState[]
  fraction: number
  /**
   * The player's own face, for the guest's badge. Absent for the host, whose
   * badge is the app's mark: they are opening the room, not entering one.
   */
  player?: PlayerFace
  /** Where Cancel goes — back to whichever front door they came through. */
  cancelHref: string
  /**
   * Anything the caller has to undo on the way out. Fires *alongside* the
   * navigation rather than instead of it, so Cancel stays a real link.
   */
  onCancel?: () => void
  /** Set when the boot stopped. Replaces the rail with what happened. */
  failure?: string
}

/**
 * The screen a room opens behind.
 *
 * It replaces a bare paragraph reading "Joining the room…" that served host
 * and guest identically and offered no way out — so the two things this adds
 * over that are the two things it is for: *which* room is opening and how far
 * along it is, and a door back if it never does.
 *
 * Presentational and role-agnostic. `RoomShell` owns the boot state; this
 * takes the answer as props, so the whole screen renders from a fixture in the
 * gallery without a transport anywhere near it.
 */
export function RoomBootScreen({
  variant,
  code,
  states,
  fraction,
  player,
  cancelHref,
  onCancel,
  failure,
}: RoomBootScreenProps) {
  const steps = BOOT_STEPS[variant].map((label, index) => ({
    label,
    state: states[index] ?? 'pending',
  }))

  // A boot that stopped, as opposed to one that is merely saying something —
  // a transient drop keeps the ring turning, because it is still trying.
  const stopped = steps.some((step) => step.state === 'failed')

  return (
    <div className={styles.screen} data-boot={variant}>
      <Wordmark size="landing" />

      <Box
        background="modal"
        radius="modal"
        padding={34}
        className={styles.card}
      >
        <Stack gap={26}>
          <Stack gap={20} align="center">
            <ProgressRing still={stopped}>
              {player ? (
                <Avatar {...player} size={88} decorative />
              ) : (
                <span className={styles.mark}>
                  <Logo size="badge" />
                </span>
              )}
            </ProgressRing>

            <Stack gap={12} align="center">
              <h1 className={styles.title}>{BOOT_TITLE[variant]}</h1>
              <span className={styles.codePill}>
                <span className={styles.codeLabel}>{CODE_LABEL[variant]}</span>
                <RoomCode code={code} size="pill" />
              </span>
            </Stack>
          </Stack>

          <Stack gap={20}>
            <BootChecklist steps={steps} />

            {failure ? (
              // A live region on the one thing that is news. The card itself is
          // not: it would re-announce the title, the code and all three rows
          // on every step, and the active row already says where the room is.
          <p className={styles.failure} role="status">
            {failure}
          </p>
            ) : (
              <ProgressRail
                fraction={fraction}
                tone="accent"
                size="bar"
                label="Opening the room"
              />
            )}

            {/* A link, not a handler: leaving is a navigation, and unmounting
                is already what tears the transport down. */}
            <Button
              href={cancelHref}
              onClick={onCancel}
              variant="ghost"
              size="text"
              fullWidth
            >
              {stopped ? 'Go back' : 'Cancel'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <p className={styles.footnote}>{BOOT_FOOTNOTE[variant]}</p>
    </div>
  )
}
