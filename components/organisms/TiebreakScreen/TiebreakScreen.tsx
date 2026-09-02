'use client'

import { Fragment } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Inline } from '@/components/atoms/Inline'
import { ProgressRail } from '@/components/atoms/ProgressRail'
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
      <Stack gap={12} align="center" className={styles.intro}>
        <Eyebrow tone="urgent">{copy.eyebrow}</Eyebrow>
        <h1 className={styles.headline}>{copy.headline}</h1>
        <p className={styles.body}>{copy.body}</p>
      </Stack>

      <div className={styles.duel}>
        {cards.map((card, i) => (
          <Fragment key={card.entryId}>
            <div className={styles.contender}>
              <MediaCard
                src={card.media?.src ?? ''}
                alt={card.media?.alt ?? `Contender ${i + 1}`}
                width={card.media?.width}
                height={card.media?.height}
                topText={card.lines?.[0]}
                bottomText={card.lines?.[1]}
                winner={myChoice === card.entryId}
                // Two cards and nothing else on the screen: there is no row for
                // a crop to keep tidy, so the frame is the image's own.
                naturalRatio
              />

              {/**
                * Who it is and how to pick them, in one box.
                *
                * A row inside the card on a phone — the design joins it to the
                * picture, which is what stops two stacked contenders reading as
                * four loose things. A centred column under the card once the
                * lanes are side by side, which is where the design puts it.
                * One arrangement, two shapes; see the stylesheet.
                */}
              <div className={styles.foot}>
                {card.author && (
                  <Inline gap={10} wrap={false} className={styles.who}>
                    <Avatar {...card.author} size={34} />
                    <span className={styles.name}>{card.author.name}</span>
                  </Inline>
                )}

                {/* A contender cannot vote in their own duel — `authorize`
                    refuses it, so offering the button would produce a snackbar
                    rather than a vote. */}
                <Button
                  blocked={card.own || voted}
                  // Named by the long label whichever one is drawn, so the
                  // button says the same thing to a screen reader at every
                  // width — the same reason `RoomToolbox`'s key carries one.
                  aria-label={card.own ? 'Your own entry' : voted ? 'Vote cast' : copy.action}
                  onClick={() => {
                    if (card.own || voted) return
                    send({ type: 'round/tiebreakVoted', choice: card.entryId })
                    notify('Vote cast')
                  }}
                >
                  {/*
                    Both labels, and CSS shows one — the same way `RoomToolbox`
                    picks between its key and its pill. On a phone this button
                    shares a row with a name, and the long label took the width
                    the name needed: "Jesska" was rendering as "Je…".
                  */}
                  <span className={styles.actionLong}>
                    {card.own ? 'Your own entry' : voted ? 'Vote cast' : copy.action}
                  </span>
                  <span className={styles.actionShort}>
                    {card.own ? 'Yours' : voted ? 'Voted' : copy.actionShort}
                  </span>
                </Button>
              </div>
            </div>

            {i < cards.length - 1 && (
              // Drawn at both sizes now: a rule across the gap on a phone with
              // the badge sitting on it, a rule down the gap beside it once the
              // lanes are side by side. It used to be hidden below `md`, which
              // is exactly where two stacked cards most need something saying
              // they are opposed rather than listed.
              <div className={styles.versus} aria-hidden="true">
                <span className={styles.versusRule} />
                <span className={styles.versusBadge}>VS</span>
                <span className={styles.versusRule} />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {/**
        * One tally, laid out the two ways the design draws it.
        *
        * Rendering both treatments and hiding one with CSS put the exclusion
        * line in the document twice — read out twice, and ambiguous to anything
        * looking for it. So there is one of each part and the *arrangement*
        * changes: a bar and a count over the caveat on a phone, the count and
        * the caveat side by side once there is a row to put them on.
        *
        * The bar is the one piece that is genuinely phone-only — a desktop has
        * the width to say "0 of 5 have voted" and no need to draw it too.
        */}
      <div className={styles.tally}>
        <div className={styles.tallyBar}>
          <ProgressRail size="bar" urgent fraction={copy.voteFraction} />
        </div>
        <StatusPill>{copy.voteLine}</StatusPill>
        {copy.exclusionLine && <p className={styles.tallyNote}>{copy.exclusionLine}</p>}
      </div>

    </Stack>
  )
}
