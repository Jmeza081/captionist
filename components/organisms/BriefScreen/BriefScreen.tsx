'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { TextField } from '@/components/atoms/TextField'
import { CycleWall } from '@/components/molecules/CycleWall'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { UpNext } from '@/components/molecules/UpNext'
import { RoundPicker } from '@/components/organisms/RoundPicker'
import { PROMPT_MAX, PROMPT_STARTERS } from '@/lib/game/constants'
import { briefCopy, roleHolder, toAvatarProps, upNextRoleHolders } from '@/lib/game/selectors'
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

/**
 * How many faces the queue shows.
 *
 * Three is the design's, and it is about as many as a pill can hold before the
 * stack stops reading as an order. `upNextRoleHolders` caps it again by the
 * rounds actually left, so a room near the end shows fewer or none.
 */
const UP_NEXT_SHOWN = 3

/**
 * What the queue means.
 *
 * The design's artboard says "order is randomised each round". It is not: the
 * rotation is `roleHolderIndex` modulo a roster kept in join order, so the
 * queue is fixed and a room could catch the claim out by round three. This says
 * the true thing instead, which is also the more useful one — those three faces
 * are a schedule, not a shuffle.
 */
const UP_NEXT_NOTE = 'in the order they joined'

export function BriefScreen() {
  const { state, selfId, send } = useRoom()

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
   * Which starter the shuffle is on.
   *
   * The five used to render as a column of chips — five sentences, each of them
   * long enough to wrap, above the field they were meant to help fill. On a
   * phone that was the whole screen, and on a desktop it pushed the preview
   * labelled "what the room sees" below the fold. One at a time in the field
   * itself is the same help without the inventory: you read the line you have
   * and press again if it is not the one.
   *
   * A cycle rather than a random draw, so pressing five times shows five
   * different starters instead of the same one twice.
   */
  const [starter, setStarter] = useState(-1)

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
  const armed = useRef({ picked, results: gifs.results, send, chose: gifs.chose, query: gifs.query })
  // Every render, deliberately: the timer must see the board as it is when it
  // fires, not as it was when it was set. Writing a ref during render is what
  // `react-hooks/refs` forbids, and it is right to — the compiler may not run
  // the render that wrote it.
  useEffect(() => {
    armed.current = { picked, results: gifs.results, send, chose: gifs.chose, query: gifs.query }
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
        const { picked, results, send, chose, query } = armed.current
        const gif = picked ?? results[Math.floor(Math.random() * results.length)]
        if (!gif) return
        fired.current = true
        // A GIF the clock chose still ends up in front of the room, so the
        // provider hears about it on the same terms as one somebody picked.
        chose(gif)
        send({
          type: 'round/subjectLocked',
          subject: { kind: 'media', media: toMediaRef(gif), ...(query ? { query } : {}) },
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
      <Stack gap={34} align="center" className={styles.waiting}>
        <Stack gap={26} align="center">
          {holder && (
            <div className={styles.halo}>
              <Avatar {...toAvatarProps(state, holder)} size={88} />
              <span className={styles.badge}>{copy.eyebrow}</span>
            </div>
          )}
          <Stack gap={14} align="center">
            <Stack gap={8} align="center">
              <h1 className={styles.waitHeadline}>{copy.headline}</h1>
              {copy.headlineSecond && (
                <p className={styles.waitSecond}>{copy.headlineSecond}</p>
              )}
            </Stack>
            {copy.body && <p className={styles.waitBody}>{copy.body}</p>}
          </Stack>
        </Stack>

        {/* The design's answer to dead time, and its own note is the brief:
            anticipation rather than an empty spinner. It is also the only thing
            on this screen that moves, now that the full-bleed clip behind the
            words is gone — one wall of GIFs beats a blurred one underneath. */}
        <CycleWall />

        {/* Who takes the role next, in the order they actually will. Renders
            nothing on the last round, when there is no next. */}
        <UpNext
          after={holder?.name ?? 'them'}
          players={upNextRoleHolders(state, UP_NEXT_SHOWN).map((player) =>
            toAvatarProps(state, player),
          )}
          note={UP_NEXT_NOTE}
        />
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

          {/* Directly under the field it fills, and quiet enough to read as a
              help rather than a second way to answer. */}
          <Inline gap={8}>
            <Button
              variant="ghost"
              size="text"
              onClick={() => {
                const next = (starter + 1) % PROMPT_STARTERS.length
                setStarter(next)
                setDraft(PROMPT_STARTERS[next] ?? '')
              }}
            >
              <Icon name="shuffle" size={14} />
              Shuffle a starter
            </Button>
          </Inline>

          <Inline gap={14}>
            {/* One label, whether or not there is a line yet. The empty field
                above is the affordance — see `RoundPicker`, which stopped
                swapping its CTA's text for the same reason. */}
            <Button
              blocked={!ready}
              onClick={() => {
                if (!ready) return
                send({ type: 'round/subjectLocked', subject: { kind: 'prompt', text } })
              }}
            >
              {copy.action}
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

  const lockIn = (gif: GifResult) => {
    // Before `toMediaRef`, which drops the id the trigger needs.
    gifs.chose(gif)
    send({
      type: 'round/subjectLocked',
      // The search that found it rides along. It is the closest thing anyone
      // will ever have to a statement of the joke intended, it used to be
      // handed to the provider and thrown away, and it is what a bot reads
      // when it captions this picture. Not a secret: the GIF is on screen.
      subject: { kind: 'media', media: toMediaRef(gif), ...(gifs.query ? { query: gifs.query } : {}) },
    })
  }

  return (
    <RoundPicker
      above={
        <Inline gap={10}>
          {holder && <Avatar {...toAvatarProps(state, holder)} size={30} />}
          <Eyebrow>{copy.eyebrow}</Eyebrow>
        </Inline>
      }
      headline={copy.headline}
      note={copy.timeoutNote}
      search={gifs}
      picked={picked}
      onPick={setPicked}
      selectionLabel="Selected"
      action={copy.action}
      onLock={lockIn}
    />
  )
}
