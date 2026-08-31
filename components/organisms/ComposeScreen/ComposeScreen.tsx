'use client'

import { useState, type CSSProperties } from 'react'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { TextField } from '@/components/atoms/TextField'
import { WaitingDots } from '@/components/atoms/WaitingDots'
import { MediaCard } from '@/components/molecules/MediaCard'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { GifPanel } from '@/components/molecules/GifPanel'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { WaitingScreen } from '@/components/organisms/WaitingScreen'
import { CAPTION_MAX, SEARCH_SUGGESTIONS } from '@/lib/game/constants'
import {
  captionFields,
  composeCopy,
  myEntry,
  requireSubject,
  roleHolder,
  submissionRows,
  submittedLine,
  toAvatarProps,
  viewKey,
} from '@/lib/game/selectors'
import { toMediaRef, type GifResult } from '@/lib/gifs/types'
import { useGifSearch } from '@/lib/gifs/useGifSearch'
import { mediaAspect } from '@/lib/media'
import { useRoom } from '@/lib/room/useRoom'
import styles from './ComposeScreen.module.scss'

/**
 * Answering the round — and, if you set it up, watching it happen.
 *
 * Four faces from `viewKey`, and the fourth is `WaitingScreen`: submitting ends
 * your round, so the composer hands over rather than sitting there with a
 * snackbar and an open field. The reducer still upserts on author — a second
 * entry from the same player replaces the first — but nothing in the UI offers
 * a second one any more. Committing to the joke is the game.
 */

export function ComposeScreen() {
  const { state, selfId, send } = useRoom()
  const { notify } = useRoomShell()
  const gifs = useGifSearch()

  /**
   * One draft string per field the room's format asks for.
   *
   * An array rather than `top`/`bottom`, because the number of fields is a
   * room setting: a one-line room has one. The answer already carries
   * `lines: readonly string[]`, so this is the same shape all the way down.
   */
  const [lines, setLines] = useState<readonly string[]>([])
  const [picked, setPicked] = useState<GifResult | undefined>(undefined)

  const setLine = (index: number, value: string) =>
    setLines((current) => {
      const next = [...current]
      while (next.length <= index) next.push('')
      next[index] = value
      return next
    })

  if (!state) return null

  /**
   * Your entry is in, so your round is over — hand the screen to the one that
   * says so.
   *
   * Read before the copy, because `composeCopy` has no face for this: there is
   * nothing to describe that `WaitingScreen` does not already draw, and a
   * second set of strings for "we are waiting" is two that drift. The phase is
   * still `compose` and still room-wide; this is its per-viewer face, exactly
   * as `pickwait` is `brief`'s.
   *
   * It also ends editing, which is the point. Submitting used to leave you on
   * the composer with a snackbar — nothing visibly happened, and the caption
   * stayed open to a rewrite until the clock died. Committing to the joke is
   * the game.
   */
  if (viewKey(state, selfId) === 'submitted') return <WaitingScreen />

  const copy = composeCopy(state, selfId)
  const subject = requireSubject(state)
  const holder = roleHolder(state)
  const mine = myEntry(state, selfId)

  /* ---------------- The role holder sits it out ---------------- */

  if (copy.view === 'watch') {
    return (
      <div className={styles.watch}>
        <Stack gap={34} align="center" className={styles.watchColumn}>
          <Stack gap={20} align="center">
            {/* Decorative: the headline under it already says what the wait is,
                and announcing it twice is once too many. The same dots the
                guest lobby waits under — this is the same kind of wait, on the
                other side of the round. */}
            <WaitingDots />
            <Stack gap={10} align="center">
              <Eyebrow>{copy.eyebrow}</Eyebrow>
              <h1 className={styles.watchHeadline}>{copy.headline}</h1>
              {copy.body && <p className={styles.watchBody}>{copy.body}</p>}
            </Stack>
          </Stack>

          <Box
            background="card"
            radius="card"
            padding={20}
            className={styles.watchCard}
          >
            <Stack gap={10}>
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
      </div>
    )
  }

  /* ---------------- Answering a prompt with a GIF ---------------- */

  if (copy.view === 'submit') {
    return (
      <Stack gap={20}>
        {subject?.kind === 'prompt' && (
          <PromptBanner
            prompt={subject.text}
            author={holder ? toAvatarProps(state, holder) : undefined}
            size="lg"
          />
        )}

        <h1 className={styles.headline}>{copy.headline}</h1>

        <GifPanel
          variant="board"
          results={gifs.results}
          status={gifs.status}
          message={gifs.message}
          query={gifs.query}
          onQueryChange={gifs.setQuery}
          onSubmit={gifs.search}
          suggestions={SEARCH_SUGGESTIONS}
          selectedId={picked?.id}
          selectionLabel="Your answer"
          onPick={setPicked}
          tools={
            <Button
              variant="secondary"
              onClick={() => {
                void gifs.surprise().then((gif) => {
                  if (gif) setPicked(gif)
                })
              }}
            >
              Surprise me
            </Button>
          }
        />

        <Inline gap={14} justify="between">
          <span className={styles.note}>{copy.body}</span>
          <Button
            blocked={!picked}
            onClick={() => {
              if (!picked) return
              send({
                type: 'round/entrySubmitted',
                answer: { kind: 'media', media: toMediaRef(picked) },
              })
              notify(mine ? 'Answer swapped' : 'Answer locked in')
            }}
          >
            {picked ? copy.action : 'Pick one first'}
          </Button>
        </Inline>
      </Stack>
    )
  }

  /* ---------------- Captioning the image ---------------- */

  const media = subject?.kind === 'media' ? subject.media : undefined
  const previewAspect = mediaAspect(media)
  const fields = captionFields(state)
  const written = lines.some((line) => line.trim().length > 0)

  const submit = (lines: readonly string[], message: string) => {
    send({ type: 'round/entrySubmitted', answer: { kind: 'caption', lines } })
    notify(message)
  }

  return (
    <div className={styles.split}>
      <Stack
        gap={12}
        className={styles.previewColumn}
        // The column is sized from the card's ratio so the preview keeps a
        // constant *height* rather than a constant width — see the stylesheet.
        style={
          previewAspect ? ({ '--media-aspect': `${previewAspect}` } as CSSProperties) : undefined
        }
      >
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        {/* The preview is the real card the room will vote on, so what you see
            while typing is exactly what they see. */}
        <MediaCard
          src={media?.src ?? ''}
          alt={media?.alt ?? 'The round’s image'}
          width={media?.width}
          height={media?.height}
          topText={lines[0]}
          bottomText={lines[1]}
        />
      </Stack>

      <Stack gap={20} className={styles.column}>
        <Stack gap={10}>
          <h1 className={styles.headline}>{copy.headline}</h1>
          {copy.body && <p className={styles.body}>{copy.body}</p>}
        </Stack>

        {fields.map((field, i) => (
          <TextField
            key={field.label}
            label={field.label}
            size="caption"
            primary={field.primary}
            showCount
            maxLength={CAPTION_MAX}
            value={lines[i] ?? ''}
            onChange={(e) => setLine(i, e.target.value)}
            placeholder={field.placeholder}
          />
        ))}

        <Inline gap={12}>
          <Button
            blocked={!written}
            onClick={() => {
              if (!written) return
              submit(
                fields.map((_, i) => lines[i]?.trim() ?? ''),
                mine ? 'Caption updated' : 'Caption submitted',
              )
            }}
          >
            {written ? copy.action : 'Write something first'}
          </Button>
          {/* Skipping still submits — an absent entry would hold the whole room
              on a clock nobody needs. */}
          <Button
            variant="secondary"
            onClick={() => submit([], 'Sitting this one out')}
          >
            {copy.secondary}
          </Button>
        </Inline>

        <p className={styles.tracker}>{submittedLine(state)}</p>
      </Stack>
    </div>
  )
}
