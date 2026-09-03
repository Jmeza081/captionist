'use client'

import { Avatar } from '@/components/atoms/Avatar'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import { TallyPill } from '@/components/atoms/TallyPill'
import { MediaCard } from '@/components/molecules/MediaCard'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { RevealReactionBar } from '@/components/molecules/RevealReactionBar'
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
import { useChat, useRoom, useTallies } from '@/lib/room/useRoom'
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

  if (!state) return null

  const copy = revealCopy(state, selfId)
  const winner = revealWinner(state)
  const others = runnersUp(state)
  const subject = requireSubject(state)
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
        <div className={styles.winnerCard}>
          <MediaCard
            src={winner?.media?.src ?? ''}
            alt={winner?.media?.alt ?? 'The winning entry'}
            width={winner?.media?.width}
            height={winner?.media?.height}
            topText={winner?.lines?.[0]}
            bottomText={winner?.lines?.[1]}
            winner
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
