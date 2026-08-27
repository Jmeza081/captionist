'use client'

import { useState } from 'react'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { TextField } from '@/components/atoms/TextField'
import { MediaCard } from '@/components/molecules/MediaCard'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { GifPanel } from '@/components/molecules/GifPanel'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { CAPTION_MAX, SEARCH_SUGGESTIONS } from '@/lib/game/constants'
import {
  composeCopy,
  myEntry,
  requireSubject,
  roleHolder,
  submissionRows,
  submittedLine,
  toAvatarProps,
} from '@/lib/game/selectors'
import { toMediaRef, type GifResult } from '@/lib/gifs/types'
import { useGifSearch } from '@/lib/gifs/useGifSearch'
import { useRoom } from '@/lib/room/useRoom'
import styles from './ComposeScreen.module.scss'

/**
 * Answering the round — and, if you set it up, watching it happen.
 *
 * Three faces from `viewKey`. Submitting again replaces your entry rather than
 * adding one (the reducer upserts on author), which is what makes "you can
 * swap it until the clock runs out" true without a second action.
 */

export function ComposeScreen() {
  const { state, selfId, send } = useRoom()
  const { notify } = useRoomShell()
  const gifs = useGifSearch()

  const [top, setTop] = useState('')
  const [bottom, setBottom] = useState('')
  const [picked, setPicked] = useState<GifResult | undefined>(undefined)

  if (!state) return null

  const copy = composeCopy(state, selfId)
  const subject = requireSubject(state)
  const holder = roleHolder(state)
  const mine = myEntry(state, selfId)

  /* ---------------- The role holder sits it out ---------------- */

  if (copy.view === 'watch') {
    return (
      <Stack gap={20}>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className={styles.headline}>{copy.headline}</h1>
        {copy.body && <p className={styles.body}>{copy.body}</p>}

        <Box background="card" radius="card" padding={20}>
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
    )
  }

  /* ---------------- Answering a prompt with a GIF ---------------- */

  if (copy.view === 'submit') {
    return (
      <Stack gap={20}>
        {subject?.kind === 'prompt' && (
          <PromptBanner
            prompt={subject.text}
            author={holder ? toAvatarProps(holder) : undefined}
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
          onQueryChange={() => {}}
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
  const written = top.trim().length > 0 || bottom.trim().length > 0

  const submit = (lines: readonly string[], message: string) => {
    send({ type: 'round/entrySubmitted', answer: { kind: 'caption', lines } })
    notify(message)
  }

  return (
    <div className={styles.split}>
      <Stack gap={12} className={styles.previewColumn}>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        {/* The preview is the real card the room will vote on, so what you see
            while typing is exactly what they see. */}
        <MediaCard
          src={media?.src ?? ''}
          alt={media?.alt ?? 'The round’s image'}
          topText={top}
          bottomText={bottom}
        />
      </Stack>

      <Stack gap={20} className={styles.column}>
        <Stack gap={10}>
          <h1 className={styles.headline}>{copy.headline}</h1>
          {copy.body && <p className={styles.body}>{copy.body}</p>}
        </Stack>

        <TextField
          label="Top text"
          size="caption"
          primary
          showCount
          maxLength={CAPTION_MAX}
          value={top}
          onChange={(e) => setTop(e.target.value)}
          placeholder="When prod goes down…"
        />
        <TextField
          label="Bottom text"
          size="caption"
          showCount
          maxLength={CAPTION_MAX}
          value={bottom}
          onChange={(e) => setBottom(e.target.value)}
          placeholder="…and I’m the only one on call"
        />

        <Inline gap={12}>
          <Button
            blocked={!written}
            onClick={() => {
              if (!written) return
              submit([top.trim(), bottom.trim()], mine ? 'Caption updated' : 'Caption submitted')
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
