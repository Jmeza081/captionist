'use client'

import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { StatusPill } from '@/components/atoms/StatusPill'
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
 * The role holder set the round up and has no entry, so the left column is
 * theirs to skip — they get the tracker alone.
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

  return (
    <div className={styles.split}>
      {mine && (
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
      )}

      <Stack gap={20} className={styles.column}>
        <Stack gap={10}>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h1 className={styles.headline}>{copy.headline}</h1>
          <p className={styles.body}>{copy.body}</p>
        </Stack>

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

        {/* Ending the wait early is `host/skippedPhase` — the same code path
            the 12s clock takes, so the button and the timeout cannot diverge.
            Host-only, because the action is — and waiting-phase only, because
            this screen now also draws the `submitted` face of *compose*, where
            "everyone's in" is not yet true and the same button would cut off
            whoever is still typing. */}
        {isHost && state.phase === 'waiting' && (
          <Button size="form" onClick={() => send({ type: 'host/skippedPhase' })}>
            {copy.action}
          </Button>
        )}
      </Stack>
    </div>
  )
}
