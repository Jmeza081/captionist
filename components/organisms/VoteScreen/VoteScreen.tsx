'use client'

import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Grid } from '@/components/atoms/Grid'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { RankSlot } from '@/components/atoms/RankSlot'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import { Stack } from '@/components/atoms/Stack'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import { TallyPill } from '@/components/atoms/TallyPill'
import { MediaCard } from '@/components/molecules/MediaCard'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { ReactionToolbar } from '@/components/molecules/ReactionToolbar'
import { TunedImage } from '@/components/molecules/TunedImage'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import {
  ballotFrom,
  clearLabel,
  hasVoted,
  lockGateFrom,
  ordinal,
  rankSlotCount,
  requireSubject,
  roleHolder,
  toAvatarProps,
  voteCards,
  voteCopy,
} from '@/lib/game/selectors'
import type { EntryId } from '@/lib/game/types'
import { idFor, labelFor, REACTIONS } from '@/lib/reactions'
import type { EventSnapshot, Tally } from '@/lib/room/events'
import { tallyKey } from '@/lib/room/events'
import { useChat, useEventSelector, useRoom } from '@/lib/room/useRoom'
import styles from './VoteScreen.module.scss'

/**
 * Ranking the room's entries.
 *
 * The ranking is **local draft state until you lock it in**, and that is not a
 * style choice: the reducer tallies the round the moment the last ballot
 * lands, so dispatching per tap would end voting for everyone the instant one
 * person filled their first slot. One `round/ballotCast`, on the button.
 *
 * `voteCards().rank` reads the *committed* ballot, which is what a returning
 * viewer sees; while you are choosing, the cards read from `draft`.
 *
 * **The tallies are live, and that is deliberate.** A running count next to
 * something being judged can herd the judgement — but a reaction here is not
 * the ballot. The ranking above is local draft state until you lock it in, so
 * an emoji cannot move a vote that has not been cast, and holding the counts
 * back until the reveal would trade the loudest part of the round for a bias
 * the mechanism does not have.
 */

/** Every tally in the room, read once for the whole grid. */
const selectTallies = (snapshot: EventSnapshot) => snapshot.tallies

export function VoteScreen() {
  const { state, selfId, send } = useRoom()
  const { notify, startReply } = useRoomShell()
  const { react } = useChat()
  const tallies = useEventSelector(selectTallies)
  const [draft, setDraft] = useState<readonly (EntryId | null)[]>([])
  /** Which card's picker is open. One at a time — they overlap otherwise. */
  const [picking, setPicking] = useState<EntryId | undefined>(undefined)

  if (!state) return null

  const copy = voteCopy(state)
  const cards = voteCards(state, selfId)
  const slots = rankSlotCount(state, selfId)
  const locked = hasVoted(state, selfId)
  const subject = requireSubject(state)
  const holder = roleHolder(state)
  // A committed ballot wins over the draft, so a re-render after locking shows
  // what the room actually holds rather than what you were typing.
  const ranked: readonly (EntryId | null)[] = locked
    ? cards
        .filter((c) => c.rank !== undefined)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        .map((c) => c.entryId)
    : draft

  const placeOf = (entryId: EntryId): 1 | 2 | 3 | undefined => {
    const at = ranked.indexOf(entryId)
    return at >= 0 ? ((at + 1) as 1 | 2 | 3) : undefined
  }

  /**
   * What a card's foot calls this entry.
   *
   * Never the caption. It is already drawn across the picture in the type the
   * design chose for it, and repeating it underneath made the foot a second,
   * worse copy — a long one wrapped to three lines and pushed the controls it
   * shares the row with out of reach.
   *
   * Not the author either, which is what a foot like this would most like to
   * carry: `project()` strips authorship from every entry but your own before
   * the state ever leaves the host, precisely so that a vote is anonymous. The
   * one screen that does name people is the tiebreak, and it is after the
   * ballot rather than during it.
   */
  const titleOf = (entryId: EntryId): string => {
    const card = cards.find((c) => c.entryId === entryId)
    if (!card) return ''
    return card.own ? 'Yours' : `${copy.entryNoun} ${cards.indexOf(card) + 1}`
  }

  /**
   * The entry's *content*, for the places that need the words themselves — the
   * rank slot you filled, and the quote a reply carries into chat.
   */
  const labelOf = (entryId: EntryId): string => {
    const card = cards.find((c) => c.entryId === entryId)
    if (!card) return ''
    if (card.lines?.[0]) return card.lines[0]
    const n = cards.indexOf(card) + 1
    return card.own ? 'Your answer' : `Answer ${n}`
  }

  const toggle = (entryId: EntryId) => {
    if (locked) return
    setDraft((current) => {
      const at = current.indexOf(entryId)
      if (at >= 0) return current.filter((id) => id !== entryId)
      if (current.length >= slots) return current
      return [...current, entryId]
    })
  }

  const clear = (index: number) => {
    if (locked) return
    setDraft((current) => current.filter((_, i) => i !== index))
  }

  const gate = lockGateFrom(state, selfId, ranked.length)

  return (
    <Stack gap={26} className={styles.screen}>
      <Stack gap={20}>
        {/* React mode's prompt takes its own full-width line: it is the shared
            context for every card, so it cannot sit beside the heading. */}
        {subject?.kind === 'prompt' && (
          <PromptBanner
            prompt={subject.text}
            author={holder ? toAvatarProps(state, holder) : undefined}
            size="sm"
          />
        )}

        <div className={styles.bar}>
          <Inline gap={20} className={styles.intro}>
            {subject?.kind === 'media' && subject.media.src && (
              // The round's own subject, beside the heading. Not a `MediaCard`
              // — it is a thumbnail of the thing being voted on rather than an
              // entry — so it needed its own set, and was the last remote
              // picture on this screen still arriving into a blank square.
              <TunedImage
                className={styles.thumb}
                src={subject.media.src}
                alt={subject.media.alt}
              />
            )}
            <Stack gap={5}>
              <h1 className={styles.headline}>{copy.heading}</h1>
              <span className={styles.subline}>{copy.subline}</span>
            </Stack>
          </Inline>

          <Stack gap={8} className={styles.picks}>
            <Eyebrow tone="muted">{copy.picksLabel}</Eyebrow>
            <Inline gap={8}>
              {Array.from({ length: slots }, (_, i) => {
                const entryId = ranked[i]
                return (
                  <RankSlot
                    key={i}
                    ordinal={copy.slotLabel ?? ordinal(i + 1)}
                    entry={entryId ? labelOf(entryId) : undefined}
                    first={i === 0}
                    onClick={() => clear(i)}
                  />
                )
              })}
            </Inline>
          </Stack>
        </div>
      </Stack>

      <Stack gap={12}>
        <span className={styles.meta}>{copy.meta}</span>

        {/* `min` rather than a breakpoint: the grid sits in the room's
            content column, which is the window minus a docked 360px rail — a
            viewport query put three cards into 288px of space. Three is still
            the ceiling; how many of them fit is the grid's own business. */}
        <Grid columns={1} mdColumns={3} fluid className={styles.cards} gap={20}>
          {cards.map((card, i) => {
            const counts: readonly Tally[] = tallies[tallyKey('entry', card.entryId)] ?? []

            return (
              <MediaCard
                key={card.entryId}
                src={card.media?.src ?? ''}
                alt={card.media?.alt ?? `Entry ${i + 1}`}
                width={card.media?.width}
                height={card.media?.height}
                topText={card.lines?.[0]}
                bottomText={card.lines?.[1]}
                own={card.own}
                ownLabel={copy.ownLabel}
                rank={placeOf(card.entryId)}
                caption={titleOf(card.entryId)}
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
                // Reacting to your own entry is allowed — it is not a vote, and
                // the room finds self-congratulation funny.
                reaction={
                  <span className={styles.reactDock}>
                    <ReactionCTA
                      active={picking === card.entryId}
                      onClick={() =>
                        setPicking((open) => (open === card.entryId ? undefined : card.entryId))
                      }
                    />
                    <span className={styles.picker}>
                      <ReactionToolbar
                        open={picking === card.entryId}
                        title={`React to ${labelOf(card.entryId) || 'this entry'}`}
                        reactions={[...REACTIONS]}
                        chosen={counts.filter((t) => t.mine).map((t) => idFor(t.emoji))}
                        flipped
                        onPick={(reaction) => {
                          react('entry', card.entryId, reaction.glyph)
                          setPicking(undefined)
                        }}
                        // Only this card's. A click on the next card's CTA
                        // reaches the outside-click listener after React has
                        // already opened that one.
                        onDismiss={() =>
                          setPicking((cur) => (cur === card.entryId ? undefined : cur))
                        }
                      />
                    </span>
                  </span>
                }
                // Answering a caption in kind is where the laughter is — and
                // the quote is what keeps the reply legible once the grid has
                // scrolled past. Your own entry included: replying to yourself
                // is not a vote, and the room finds that funny too.
                reply={
                  <button
                    type="button"
                    className={styles.replyKey}
                    onClick={() =>
                      startReply({
                        ...(card.media?.src ? { src: card.media.src } : {}),
                        caption: labelOf(card.entryId),
                      })
                    }
                    aria-label={`Reply in chat to ${labelOf(card.entryId) || 'this entry'}`}
                  >
                    <Icon name="chat" size={14} />
                  </button>
                }
                // The picture is what people reach for. Same toggle as the
                // button below it, and never on your own entry — that card has
                // no action to take.
                onActivate={card.own || locked ? undefined : () => toggle(card.entryId)}
                action={
                  card.own ? undefined : (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => toggle(card.entryId)}
                    >
                      {placeOf(card.entryId)
                        ? clearLabel(state, placeOf(card.entryId) ?? 1)
                        : copy.pickAction}
                    </Button>
                  )
                }
              />
            )
          })}
        </Grid>
      </Stack>

      {/* `data-action-dock` is what lifts the floating keys above this bar
          instead of leaving them on top of it — see `RoomShell.module.scss`. */}
      <div className={styles.lockDock} data-action-dock>
        <Button
          size="form"
          fullWidth
          blocked={!gate.ok || locked}
          onClick={() => {
            if (!gate.ok || locked) return
            const ballot = ballotFrom(state, ranked.filter((id): id is EntryId => id !== null))
            if (!ballot) return
            send({ type: 'round/ballotCast', ballot })
            notify(copy.lockedLabel)
          }}
        >
          {locked ? copy.lockedLabel : gate.ok ? copy.lockAction : gate.label}
        </Button>
      </div>
    </Stack>
  )
}
