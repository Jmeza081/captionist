'use client'

import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { StatusPill } from '@/components/atoms/StatusPill'
import { WaitingDots } from '@/components/atoms/WaitingDots'
import { MediaCard } from '@/components/molecules/MediaCard'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import {
  myEntry,
  requireSubject,
  submissionRows,
  submittedLine,
  waitingCopy,
} from '@/lib/game/selectors'
import { useRoom } from '@/lib/room/useRoom'
import styles from './WaitingScreen.module.scss'

/**
 * Your entry is in; the room is not.
 *
 * The design's "Edit my caption" is deliberately absent. Phase is room-wide
 * and authoritative, so a guest cannot rewind the room to `compose`, and an
 * inline editor here would be a second composer to hold in step with the real
 * one. `waitingCopy` says what happens next instead of promising an edit.
 *
 * Two faces, and the difference is whether you have an entry at all. With one,
 * your card is the subject and the tracker sits beside it. Without one — the
 * role holder, who set the round up and sits it out — there is no subject, so
 * it is the same centred interstitial `ComposeScreen`'s watch face draws, one
 * phase later: dots, a capped measure, the room's glow.
 */
export function WaitingScreen() {
  const { state, selfId, isHost, send } = useRoom()
  if (!state) return null

  const copy = waitingCopy(state)
  const mine = myEntry(state, selfId)
  const subject = requireSubject(state)
  const shared = subject?.kind === 'media' ? subject.media : undefined
  // Caption mode overlays your lines on the round's shared image; react mode's
  // entry *is* the image. Same branch `voteCards` makes, one card earlier.
  const media = mine?.answer.kind === 'media' ? mine.answer.media : shared
  const lines = mine?.answer.kind === 'caption' ? mine.answer.lines : undefined

  const tracker = (
    <Stack gap={12}>
      <Inline gap={12} justify="between">
        <Eyebrow tone="muted">{copy.trackerLabel}</Eyebrow>
        <span className={styles.count}>{submittedLine(state)}</span>
      </Inline>

      <Box background="card" radius="card" padding={20}>
        <Stack gap={8}>
          {submissionRows(state).map((row) => (
            <PlayerRow
              key={row.player.name}
              player={row.player}
              variant="tracker"
              status={row.status}
              done={row.done}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  )

  /* Ending the wait early is `host/skippedPhase` — the same code path the
     clock takes, so the button and the timeout cannot diverge. Host-only,
     because the action is; waiting-phase only, because this screen also draws
     the `submitted` face of *compose*, where cutting the wait short would cut
     off whoever is still typing; and `copy.action`-only, because once everyone
     is in there is no wait to end. `waitingCopy` drops the string there rather
     than offering a gate over a door that is already closing. */
  const hostAction = isHost && state.phase === 'waiting' && copy.action && (
    <Button size="form" onClick={() => send({ type: 'host/skippedPhase' })}>
      {copy.action}
    </Button>
  )

  /* ---------------- No entry of your own: the interstitial ---------------- */

  if (!mine) {
    return (
      <div className={styles.solo}>
        <Stack gap={34} align="center" className={styles.soloColumn}>
          <Stack gap={20} align="center">
            {/* Decorative: the headline under it already says what the wait is,
                and announcing it twice is once too many. */}
            <WaitingDots />
            <Stack gap={10} align="center">
              <Eyebrow>{copy.eyebrow}</Eyebrow>
              <h1 className={styles.headline}>{copy.headline}</h1>
              <p className={styles.body}>{copy.body}</p>
            </Stack>
          </Stack>

          <Stack gap={20} className={styles.soloBlock}>
            {tracker}
            {hostAction}
          </Stack>
        </Stack>
      </div>
    )
  }

  /* ---------------- Your card, and the room beside it ---------------- */

  return (
    <div className={styles.split}>
      <Stack gap={12} className={styles.previewColumn}>
        <div className={styles.card}>
          <MediaCard
            src={media?.src ?? ''}
            alt={media?.alt ?? 'Your entry'}
            width={media?.width}
            height={media?.height}
            topText={lines?.[0]}
            bottomText={lines?.[1]}
          />
          <span className={styles.lockedDock}>
            <StatusPill context="media" confirmed>
              {copy.locked}
            </StatusPill>
          </span>
        </div>
      </Stack>

      <Stack gap={20} className={styles.column}>
        <Stack gap={10}>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h1 className={styles.headline}>{copy.headline}</h1>
          <p className={styles.body}>{copy.body}</p>
        </Stack>

        {tracker}
        {hostAction}
      </Stack>
    </div>
  )
}
