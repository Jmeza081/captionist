'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { SceneBackdrop } from '@/components/atoms/SceneBackdrop'
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
import { BACKDROP_SLUG } from '@/lib/gifs/art'
import { toBackdrop } from '@/lib/gifs/backdrop'
import { intendedProvider } from '@/lib/gifs/registry'
import { useResolvedOne } from '@/lib/gifs/useArt'
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

/**
 * How long before the brief clock expires the screen picks for you.
 *
 * Long enough that the locked subject reaches the host before its own
 * `clock/expired` does, short enough that it is the deadline rather than a
 * screen that lost patience. The reducer has its own fallback for a role
 * holder whose tab is gone; this one exists so the room gets a GIF somebody
 * was actually looking at rather than one off the offline shelf.
 */
const AUTO_PICK_LEAD_MS = 1_200

export function BriefScreen() {
  const { state, selfId, send } = useRoom()
  const { notify } = useRoomShell()

  // Above the early returns, because hooks are. Both tolerate no room — and
  // `copy` has to be resolved before `useGifSearch`, because it decides
  // whether this screen fetches at all.
  const copy = state ? briefCopy(state, selfId) : undefined
  const holder = state ? roleHolder(state) : undefined

  /**
   * Only `pick` draws a board.
   *
   * The other three faces of this screen — `prompt`, and the two waits — have
   * no picker on them, and this hook used to fetch for all four. In `react`
   * mode that meant every player in the room spent an API call each round
   * watching somebody else type. See ADR-0021.
   */
  const gifs = useGifSearch({
    enabled: copy?.view === 'pick',
    onExhausted: () => send({ type: 'game/gifsExhausted' }),
  })

  const [picked, setPicked] = useState<GifResult | undefined>(undefined)
  const [draft, setDraft] = useState('')

  /**
   * The clock picks for you.
   *
   * A timer set against the deadline rather than a subscription to the
   * countdown: this fires once, and a ticking hook here would be a second
   * interval on a page that deliberately runs one (see `RoomShell`).
   *
   * What it picks is read through a ref at fire time, so browsing the board or
   * staging a tile does not restart the timer — only a new deadline does. Your
   * own staged pick wins; failing that, a random tile off the board you were
   * looking at.
   */
  /**
   * Resolved in the browser, so there is a beat with no clip.
   *
   * The screen used to render nothing at all for it. It tunes static instead —
   * `SceneBackdrop` draws the state rather than the absence — and settles to a
   * plain background if the lookup comes back with nothing.
   */
  const waiting = useResolvedOne(BACKDROP_SLUG)
  const backdrop = waiting.gif ? toBackdrop(waiting.gif) : undefined

  const armed = useRef({ picked, results: gifs.results, send, chose: gifs.chose })
  // Every render, deliberately: the timer must see the board as it is when it
  // fires, not as it was when it was set. Writing a ref during render is what
  // `react-hooks/refs` forbids, and it is right to — the compiler may not run
  // the render that wrote it.
  useEffect(() => {
    armed.current = { picked, results: gifs.results, send, chose: gifs.chose }
  })
  const fired = useRef(false)

  const deadline =
    copy?.view === 'pick' && state?.clock.status === 'running' && !state.round?.subject
      ? state.clock.endsAt
      : undefined

  useEffect(() => {
    if (deadline === undefined) return
    fired.current = false
    const id = setTimeout(
      () => {
        if (fired.current) return
        const { picked, results, send, chose } = armed.current
        const gif = picked ?? results[Math.floor(Math.random() * results.length)]
        if (!gif) return
        fired.current = true
        // A GIF the clock chose still ends up in front of the room, so the
        // provider hears about it on the same terms as one somebody picked.
        chose(gif)
        send({
          type: 'round/subjectLocked',
          subject: { kind: 'media', media: toMediaRef(gif) },
        })
      },
      Math.max(0, deadline - AUTO_PICK_LEAD_MS - Date.now()),
    )
    return () => clearTimeout(id)
  }, [deadline])

  if (!state || !copy) return null

  /* ---------------- Waiting on someone else ---------------- */

  if (copy.view === 'pickwait' || copy.view === 'promptwait') {
    return (
      <>
        {/* The barest screen in the app — an avatar, a headline and a lot of
            canvas — so it gets something to look at while somebody else works.
            Behind the content and inert; the clip is nearly black with one
            warm ember, which is why a soft scrim is enough.

            A *sibling* of the column, not a child of it: the backdrop is
            positioned and the headline is not, so inside the same stacking
            context the backdrop would paint over the words it is supposed to
            sit behind. Out here it is the column that takes the layer. */}
        {/* Static while the clip is still coming, the clip once it lands, and
            nothing at all if it never does. */}
        <SceneBackdrop
          mp4={backdrop?.mp4}
          still={backdrop?.still}
          tuning={waiting.pending}
          scrim="full"
        />

        <Stack gap={20} align="center" className={styles.waiting}>
          {holder && (
            <div className={styles.halo}>
              <Avatar {...toAvatarProps(state, holder)} size={88} />
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

          {/* Somebody's work, not our chrome. Small, last, and out of the way —
              but present, because the alternative is using it uncredited. No
              link: the provider publishes a title, not an uploader page. */}
          {backdrop && (
            <span className={styles.credit}>
              Backdrop “{backdrop.credit}” via {intendedProvider().descriptor.name}
            </span>
          )}
        </Stack>
      </>
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
            {holder && <Avatar {...toAvatarProps(state, holder)} size={30} />}
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
            author={holder ? toAvatarProps(state, holder) : undefined}
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
    // Before `toMediaRef`, which drops the id the trigger needs.
    gifs.chose(gif)
    send({ type: 'round/subjectLocked', subject: { kind: 'media', media: toMediaRef(gif) } })
  }

  return (
    <Stack gap={20}>
      <Inline gap={10}>
        {holder && <Avatar {...toAvatarProps(state, holder)} size={30} />}
        <Eyebrow>{copy.eyebrow}</Eyebrow>
      </Inline>

      <h1 className={styles.headline}>{copy.headline}</h1>

      {/* Under the headline, where it is read once on the way in, rather than
          pinned to the bottom beside the button — a note about the clock is
          context for the whole screen, not a label on the action. */}
      <p className={styles.note}>{copy.timeoutNote}</p>

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
        selectionLabel="Selected"
        searchesLeft={gifs.remaining}
        provider={gifs.descriptor}
        ads={gifs.ads}
        onPick={setPicked}
        // Both controls sit with the search field: everything that changes what
        // the board shows, and then the one thing that ends the phase. It keeps
        // the action in reach at the top of a board that scrolls a long way,
        // which is what the foot row underneath it could not do.
        tools={
          <>
            {/*
              Free, and instant. This used to fetch the next page of results,
              which was a whole API call to show you something the board in
              front of you could already answer — it holds fifty tiles now,
              not twelve. `surprise` reads from those.
            */}
            <Button
              variant="secondary"
              onClick={() => {
                const gif = gifs.surprise()
                if (gif) {
                  setPicked(gif)
                  notify('Picked one for you — our taste is questionable')
                }
              }}
            >
              {copy.secondary}
            </Button>
            <Button blocked={!picked} onClick={() => lockIn(picked)}>
              {picked ? copy.action : 'Pick one first'}
            </Button>
          </>
        }
      />
    </Stack>
  )
}
