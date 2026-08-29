'use client'

import { useState } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Chip } from '@/components/atoms/Chip'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { TextField } from '@/components/atoms/TextField'
import { GifPanel } from '@/components/molecules/GifPanel'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { PROMPT_MAX, PROMPT_STARTERS, SEARCH_SUGGESTIONS } from '@/lib/game/constants'
import { briefCopy, roleHolder, toAvatarProps } from '@/lib/game/selectors'
import { useGifSearch } from '@/lib/gifs/useGifSearch'
import { toMediaRef, type GifResult } from '@/lib/gifs/types'
import { useRoom } from '@/lib/room/useRoom'
import styles from './BriefScreen.module.scss'

/**
 * Setting the round up — and watching someone else do it.
 *
 * One organism for four designed screens. Which face renders comes from
 * `viewKey`, and every string comes from `briefCopy`, so nothing here asks
 * which mode the room is in. That is what stops this forking in two.
 */

export function BriefScreen() {
  const { state, selfId, send } = useRoom()
  const { notify } = useRoomShell()
  const gifs = useGifSearch()

  const [picked, setPicked] = useState<GifResult | undefined>(undefined)
  const [draft, setDraft] = useState('')

  if (!state) return null

  const copy = briefCopy(state, selfId)
  const holder = roleHolder(state)

  /* ---------------- Waiting on someone else ---------------- */

  if (copy.view === 'pickwait' || copy.view === 'promptwait') {
    return (
      <Stack gap={20} align="center" className={styles.waiting}>
        {holder && (
          <div className={styles.halo}>
            <Avatar {...toAvatarProps(holder)} size={88} />
            <span className={styles.badge}>{copy.eyebrow}</span>
          </div>
        )}
        <Stack gap={8} align="center">
          <h1 className={styles.waitHeadline}>{copy.headline}</h1>
          {copy.headlineSecond && (
            <p className={styles.waitSecond}>{copy.headlineSecond}</p>
          )}
        </Stack>
        {copy.body && <p className={styles.waitBody}>{copy.body}</p>}
      </Stack>
    )
  }

  /* ---------------- Writing the prompt ---------------- */

  if (copy.view === 'prompt') {
    const text = draft.trim()
    const ready = text.length > 0

    return (
      <div className={styles.split}>
        <Stack gap={20} className={styles.column}>
          <Inline gap={10}>
            {holder && <Avatar {...toAvatarProps(holder)} size={30} />}
            <Eyebrow>{copy.eyebrow}</Eyebrow>
          </Inline>

          <Stack gap={10}>
            <h1 className={styles.headline}>{copy.headline}</h1>
            {copy.body && <p className={styles.body}>{copy.body}</p>}
          </Stack>

          <TextField
            label="The prompt"
            size="caption"
            primary
            showCount
            maxLength={PROMPT_MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="when the deploy succeeds on the first try…"
          />

          <Stack gap={10}>
            <Eyebrow tone="muted">Need a starter</Eyebrow>
            <Inline gap={8}>
              {PROMPT_STARTERS.map((starter) => (
                <Chip
                  key={starter}
                  selected={draft === starter}
                  onClick={() => setDraft(starter)}
                >
                  {starter}
                </Chip>
              ))}
            </Inline>
          </Stack>

          <Inline gap={14}>
            <Button
              blocked={!ready}
              onClick={() => {
                if (!ready) return
                send({ type: 'round/subjectLocked', subject: { kind: 'prompt', text } })
              }}
            >
              {ready ? copy.action : 'Write a line first'}
            </Button>
            <span className={styles.note}>{copy.timeoutNote}</span>
          </Inline>
        </Stack>

        <Stack gap={10} className={styles.preview}>
          <Eyebrow tone="muted">What the room sees</Eyebrow>
          <PromptBanner
            prompt={text || 'Your prompt lands here.'}
            author={holder ? toAvatarProps(holder) : undefined}
            label="Your prompt"
            size="lg"
          />
        </Stack>
      </div>
    )
  }

  /* ---------------- Picking the image ---------------- */

  const lockIn = (gif: GifResult | undefined) => {
    if (!gif) return
    send({ type: 'round/subjectLocked', subject: { kind: 'media', media: toMediaRef(gif) } })
  }

  return (
    <Stack gap={20}>
      <Inline gap={10}>
        {holder && <Avatar {...toAvatarProps(holder)} size={30} />}
        <Eyebrow>{copy.eyebrow}</Eyebrow>
      </Inline>

      <Inline gap={14} justify="between">
        <h1 className={styles.headline}>{copy.headline}</h1>
        <span className={styles.note}>Powered by Giphy · SFW filter on</span>
      </Inline>

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
        selectionLabel="Selected"
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

      <Box background="none" padding={0}>
        <Inline gap={14} justify="between">
          <span className={styles.note}>{copy.timeoutNote}</span>
          <Inline gap={12}>
            <Button
              variant="secondary"
              onClick={() => {
                gifs.shuffle()
                notify('Fresh batch — same taste')
              }}
            >
              {copy.secondary}
            </Button>
            <Button blocked={!picked} onClick={() => lockIn(picked)}>
              {picked ? copy.action : 'Pick one first'}
            </Button>
          </Inline>
        </Inline>
      </Box>
    </Stack>
  )
}
