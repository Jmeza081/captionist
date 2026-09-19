'use client'

import { useEffect } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import { TallyPill } from '@/components/atoms/TallyPill'
import { ExportKey } from '@/components/molecules/ExportKey'
import { MediaCard } from '@/components/molecules/MediaCard'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { RevealReactionBar } from '@/components/molecules/RevealReactionBar'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { memeJob } from '@/lib/export/jobs'
import { useExport } from '@/lib/export/useExport'
import {
  REVEAL_REACTIONS,
  requireSubject,
  revealCopy,
  revealWinner,
  roleHolder,
  runnersUp,
  toAvatarProps,
} from '@/lib/game/selectors'
import { glyphFor, idFor, labelFor } from '@/lib/reactions'
import { useChat, useRoom, useRoomFlags, useTallies } from '@/lib/room/useRoom'
import styles from './RevealScreen.module.scss'

/**
 * Where anonymity ends.
 *
 * The reaction bar publishes onto the event lane, so the counts on the winning
 * card are the room's rather than this viewer's — which is what the local-only
 * state here stood in for until the lane carried anything. Reacting is not
 * voting: the round is already scored by the time this screen renders, so
 * there is nothing left for a tally to sway.
 *
 * Untimed by design, so the host's button is the only way out. It is not
 * offered to a guest: `round/advanced` is host-only, and a button that only
 * ever produced a refusal snackbar is not a button.
 */
export function RevealScreen() {
  const { state, selfId, isHost, send } = useRoom()
  const { react } = useChat()
  // Read before the guard below, because `useTallies` is a hook and a hook
  // cannot sit behind an early return. An empty id simply has no tallies.
  const winnerId = state ? (revealWinner(state)?.entryId ?? '') : ''
  const counts = useTallies('entry', winnerId)
  const { notify } = useRoomShell()
  const { exportMedia } = useRoomFlags()
  const exporter = useExport(notify)

  const winner = state ? revealWinner(state) : undefined
  const subject = state ? requireSubject(state) : undefined
  /*
    The file, made before anyone asks for it.

    A share sheet has to open inside the tap's activation window, and a
    re-encode of a long GIF does not fit in one. So the reveal — one card,
    untimed, everyone looking at it — renders at idle, and the tap shares a
    file that already exists. Only here: the vote has nineteen cards and no
    idea which one will be wanted.
  */
  const job =
    exportMedia && state && winner
      ? memeJob({
          id: winner.entryId,
          mode: state.settings.mode,
          media: winner.media,
          lines: winner.lines,
          prompt: subject?.kind === 'prompt' ? subject.text : undefined,
          author: winner.author ? { face: winner.author, points: winner.points } : undefined,
          roundNumber: state.roundNumber,
        })
      : undefined
  const { prepare } = exporter
  useEffect(() => {
    if (job) prepare(job)
    // Keyed on the entry, not the job object, which is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, prepare])

  if (!state) return null

  const copy = revealCopy(state, selfId)
  const others = runnersUp(state)
  const holder = roleHolder(state)

  return (
    <Stack gap={26} align="center" className={styles.screen}>
      <Stack gap={12} align="center">
        <Inline gap={8}>
          <Icon name="star" size={20} color="var(--reveal-star)" />
          <Eyebrow tone="winner">{copy.eyebrow}</Eyebrow>
        </Inline>
        <h1 className={styles.headline}>{copy.headline}</h1>
      </Stack>

      <div className={styles.payload}>
        {/* No card for a round nobody voted in — there is no winning entry to
            draw, and an empty frame would be the hole `TunedImage` exists to
            fill. `revealCopy` carries the headline for that round. */}
        {winner && (
          <div className={styles.winnerCard}>
            <MediaCard
              src={winner.media?.src ?? ''}
              alt={winner.media?.alt ?? 'The winning entry'}
              width={winner.media?.width}
              height={winner.media?.height}
              topText={winner.lines?.[0]}
              bottomText={winner.lines?.[1]}
              winner
              share={
                job ? (
                  <ExportKey
                    label={exporter.labelFor(job)}
                    busy={exporter.busy(job.id)}
                    progress={exporter.progress(job.id)}
                    onClick={() => exporter.run(job)}
                    className={styles.exportKey}
                  />
                ) : undefined
              }
              tallies={
                counts.length > 0
                  ? counts.map((tally) => (
                      <TallyPill
                        key={tally.emoji}
                        glyph={<ReactionGlyph glyph={tally.emoji} />}
                        count={tally.count}
                        mine={tally.mine}
                        context="media"
                        label={labelFor(tally.emoji)}
                      />
                    ))
                  : undefined
              }
            />
          </div>
        )}

        <Stack gap={20} className={styles.column}>
          {subject?.kind === 'prompt' && (
            <PromptBanner
              prompt={subject.text}
              author={holder ? toAvatarProps(state, holder) : undefined}
              size="sm"
            />
          )}

          {winner?.author && (
            <Box radius="card" padding={20} className={styles.attribution}>
              <Inline gap={14}>
                <Avatar {...winner.author} size={56} selected />
                <Stack gap={2} className={styles.who}>
                  <span className={styles.winnerName}>{winner.author.name}</span>
                  <span className={styles.winnerSub}>{copy.winnerSub}</span>
                </Stack>
                <span className={styles.winnerPoints}>{copy.winnerPoints}</span>
              </Inline>
            </Box>
          )}

          {/* The phone drops the runners-up list, so this is the only place a
              non-winner learns where they came. */}
          {copy.placement && (
            <div className={styles.placement}>
              <span>{copy.placement}</span>
            </div>
          )}

          {others.length > 0 && (
            <Stack gap={12} className={styles.runners}>
              <Eyebrow tone="muted">{copy.runnersUpLabel}</Eyebrow>
              <Stack gap={8}>
                {others.map((entry, i) => (
                  <Inline key={entry.entryId} gap={14} className={styles.runner}>
                    <span className={styles.runnerRank}>{i + 2}</span>
                    {entry.author && <Avatar {...entry.author} size={34} />}
                    <Stack gap={2} className={styles.who}>
                      <span className={styles.runnerTitle}>
                        {entry.lines?.[0] ?? entry.media?.alt ?? 'An entry'}
                      </span>
                      <span className={styles.runnerAuthor}>{entry.author?.name}</span>
                    </Stack>
                    <span className={styles.runnerPoints}>+{entry.points}</span>
                  </Inline>
                ))}
              </Stack>
            </Stack>
          )}

          <div className={styles.reactions}>
            <RevealReactionBar
              reactions={[...REVEAL_REACTIONS]}
              // What the room has recorded, not what this tab remembers
              // tapping. A reaction only ever adds, so the pressed state and
              // the tally cannot disagree.
              chosen={counts.filter((t) => t.mine).map((t) => idFor(t.emoji))}
              onReact={(id) => {
                if (winnerId) react('entry', winnerId, glyphFor(id))
              }}
            />
          </div>

          {isHost && (
            <Button size="form" fullWidth onClick={() => send({ type: 'round/advanced' })}>
              {copy.action}
            </Button>
          )}
        </Stack>
      </div>
    </Stack>
  )
}
