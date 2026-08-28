'use client'

import { Avatar, type AvatarProps } from '@/components/atoms/Avatar'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { ProgressRail } from '@/components/atoms/ProgressRail'
import { Stack } from '@/components/atoms/Stack'
import styles from './ReconnectOverlay.module.scss'

export interface ReconnectOverlayProps {
  headline: string
  body: string
  attempt: string
  countdown: string
  identity: string
  where: string
  /**
   * How much of the held seat is left, 0–1 — and `undefined` when no seat is
   * being held at all.
   *
   * A seat is held by the *host*, so if the host is what vanished there is no
   * deadline to count down. Rendering a bar at zero in that case would say
   * "you have run out of time" when the truth is "nobody is keeping time".
   */
  fraction?: number
  countdownShown?: boolean
  player?: Pick<AvatarProps, 'name' | 'color' | 'src' | 'avatarSeed'>
  onRejoin: () => void
  onLeave: () => void
}

/**
 * The room is still there; you are not attached to it.
 *
 * Red rather than purple, which is the design system's own rule: an error is
 * not the app asking for a decision. The room behind stays mounted and blurs —
 * `GuestClient` holds the last state it saw, so there is something real back
 * there rather than a spinner over nothing, and that is the whole message.
 *
 * Everything it says is checkable: the seat really is held for
 * `SEAT_GRACE_MS`, the entry really does survive a drop, and the score is
 * folded from `history`, which a disconnect does not touch.
 *
 * "Rejoin now" is an override of a retry already running, not the only way
 * back — hence the attempt counter beside it.
 */
export function ReconnectOverlay({
  headline,
  body,
  attempt,
  countdown,
  identity,
  where,
  fraction,
  countdownShown = true,
  player,
  onRejoin,
  onLeave,
}: ReconnectOverlayProps) {
  return (
    <div className={styles.overlay} role="alertdialog" aria-label={headline}>
      <span className={styles.edge} aria-hidden="true" />

      <Box radius="modal" padding={26} className={styles.card}>
        <Stack gap={20} align="center">
          <span className={styles.medallion} aria-hidden="true">
            <Icon name="wifiOff" size={30} color="var(--reconnect-accent)" />
          </span>

          <Stack gap={12} align="center">
            <h2 className={styles.headline}>{headline}</h2>
            <p className={styles.body}>{body}</p>
          </Stack>

          <Stack gap={10} className={styles.progress}>
            {countdownShown && fraction !== undefined && (
              <ProgressRail fraction={fraction} urgent size="bar" label={countdown} />
            )}
            <Inline gap={12} justify="between">
              <span className={styles.attempt}>{attempt}</span>
              {countdownShown && fraction !== undefined && (
                <span className={styles.countdown}>{countdown}</span>
              )}
            </Inline>
          </Stack>

          <Box radius="field" padding={14} className={styles.identity}>
            <Inline gap={14}>
              {player && <Avatar {...player} size={40} />}
              <Stack gap={2}>
                <span className={styles.who}>{identity}</span>
                <span className={styles.where}>{where}</span>
              </Stack>
            </Inline>
          </Box>

          <Stack gap={12} align="center" className={styles.actions}>
            <Button size="form" fullWidth onClick={onRejoin}>
              Rejoin now
            </Button>
            <Button variant="ghost" onClick={onLeave}>
              Leave the game instead
            </Button>
          </Stack>
        </Stack>
      </Box>
    </div>
  )
}
