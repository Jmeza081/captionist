'use client'

import { Avatar } from '@/components/atoms/Avatar'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { StatusPill } from '@/components/atoms/StatusPill'
import { MediaCard } from '@/components/molecules/MediaCard'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { hasTiebreakVoted, tiebreakCards, tiebreakCopy } from '@/lib/game/selectors'
import { useRoom } from '@/lib/room/useRoom'
import styles from './TiebreakScreen.module.scss'

/**
 * Sudden death, in both modes.
 *
 * The one screen before the reveal that names people. A head-to-head cannot be
 * anonymous — you are choosing between two colleagues, not two anonymous
 * cards — so `project.ts` narrows the tiebreak's author map to exactly these
 * contenders rather than stripping it.
 *
 * Two primary buttons, which is the deliberate exception to "one primary
 * action per screen": here the choice *is* the phase.
 */
export function TiebreakScreen() {
  const { state, selfId, send } = useRoom()
  const { notify } = useRoomShell()
  if (!state) return null

  const copy = tiebreakCopy(state)
  const cards = tiebreakCards(state, selfId)
  const voted = hasTiebreakVoted(state, selfId)
  const myChoice = state.round?.tiebreak?.votes[selfId]

  return (
    <Stack gap={26} align="center" className={styles.screen}>
      <Stack gap={12} align="center">
        <Eyebrow tone="urgent">{copy.eyebrow}</Eyebrow>
        <h1 className={styles.headline}>{copy.headline}</h1>
        <p className={styles.body}>{copy.body}</p>
      </Stack>

      <div className={styles.duel}>
        {cards.map((card, i) => (
          <div key={card.entryId} className={styles.lane}>
            <Stack gap={14} align="center" className={styles.contender}>
              <MediaCard
                src={card.media?.src ?? ''}
                alt={card.media?.alt ?? `Contender ${i + 1}`}
                width={card.media?.width}
                height={card.media?.height}
                topText={card.lines?.[0]}
                bottomText={card.lines?.[1]}
                winner={myChoice === card.entryId}
              />

              {card.author && (
                <Inline gap={10}>
                  <Avatar {...card.author} size={34} />
                  <span className={styles.name}>{card.author.name}</span>
                </Inline>
              )}

              {/* A contender cannot vote in their own duel — `authorize`
                  refuses it, so offering the button would produce a snackbar
                  rather than a vote. */}
              <Button
                blocked={card.own || voted}
                onClick={() => {
                  if (card.own || voted) return
                  send({ type: 'round/tiebreakVoted', choice: card.entryId })
                  notify('Vote cast')
                }}
              >
                {card.own ? 'Your own entry' : voted ? 'Vote cast' : copy.action}
              </Button>
            </Stack>

            {i < cards.length - 1 && (
              <div className={styles.versus} aria-hidden="true">
                <span className={styles.versusLabel}>VS</span>
                <span className={styles.versusRule} />
              </div>
            )}
          </div>
        ))}
      </div>

      <StatusPill note={copy.exclusionLine}>{copy.voteLine}</StatusPill>
    </Stack>
  )
}
