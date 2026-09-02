'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/atoms/Button'
import { Stack } from '@/components/atoms/Stack'
import { GifPanel } from '@/components/molecules/GifPanel'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { SEARCH_SUGGESTIONS } from '@/lib/game/constants'
import type { GifResult } from '@/lib/gifs/types'
import type { GifSearch } from '@/lib/gifs/useGifSearch'
import styles from './RoundPicker.module.scss'

/**
 * Searching a provider for the GIF that ends your turn.
 *
 * Both modes do this, and they used to do it twice. The Captionist picks the
 * image the room will caption; in `react` everyone else answers the Prompter's
 * line with one. Same field, same suggestion chips, same shuffle, same
 * "Surprise me", same board, same one control that commits — so the same
 * screen, and what differs is a headline, a note, and whatever sits above them
 * saying what you are answering.
 *
 * Not `GifPanel`: that is the field and the grid, and it is also the composer's
 * attach-a-GIF popover. This is the screen body around it — the part that
 * knows a *round* is waiting on the answer.
 *
 * The board itself belongs to the screen above, not to this component:
 * `useGifSearch` decides whether a face fetches at all, and `BriefScreen`'s
 * clock reads the staged tile to pick for you when it runs out. So both arrive
 * as props and this stays a layout with two buttons in it.
 */

export interface RoundPickerProps {
  /** What you are answering — the round's prompt, or who is up. */
  above?: ReactNode
  headline: string
  /** The quiet line under it: what the clock will do, or what committing costs. */
  note?: string
  /** The board, its query, and its two page controls. */
  search: GifSearch
  /** The staged tile. Held above, because the brief's clock reads it. */
  picked?: GifResult
  onPick: (gif: GifResult) => void
  /** The badge on the staged tile — "Selected" picking, "Your answer" answering. */
  selectionLabel: string
  /** Verb-first, and only once something is staged. */
  action?: string
  /** What the CTA says while nothing is. Blocked is not disabled. */
  blockedAction: string
  /** Commit. Called with the staged tile, never with nothing. */
  onLock: (gif: GifResult) => void
  /** One-tap searches under the field. */
  suggestions?: readonly string[]
}

export function RoundPicker({
  above,
  headline,
  note,
  search,
  picked,
  onPick,
  selectionLabel,
  action,
  blockedAction,
  onLock,
  suggestions = SEARCH_SUGGESTIONS,
}: RoundPickerProps) {
  const { notify } = useRoomShell()

  return (
    <Stack gap={20}>
      {above}

      <h1 className={styles.headline}>{headline}</h1>

      {/* Under the headline, where it is read once on the way in, rather than
          pinned to the bottom beside the button — a note about the clock, or
          about a choice being final, is context for the whole screen rather
          than a label on the action. */}
      {note && <p className={styles.note}>{note}</p>}

      <GifPanel
        variant="board"
        results={search.results}
        status={search.status}
        message={search.message}
        query={search.query}
        onQueryChange={search.setQuery}
        onSubmit={search.search}
        suggestions={suggestions}
        selectedId={picked?.id}
        selectionLabel={selectionLabel}
        onMore={search.more}
        provider={search.descriptor}
        ads={search.ads}
        onPick={onPick}
        // Both controls sit with the search field: everything that changes what
        // the board shows, and then the one thing that ends the phase. It keeps
        // the action in reach at the top of a board that scrolls a long way,
        // which is what a foot row underneath it could not do.
        tools={
          <>
            {/*
              Free, and instant: it reads off the fifty tiles already on the
              board rather than fetching a page of its own. Distinct from
              "Shuffle results" beside the search field, which does go and get
              another board — this one commits to a tile, that one changes what
              there is to commit to.
            */}
            <Button
              variant="secondary"
              onClick={() => {
                const gif = search.surprise()
                if (!gif) return
                onPick(gif)
                notify('Picked one for you — our taste is questionable')
              }}
            >
              Surprise me
            </Button>
            <Button blocked={!picked} onClick={() => picked && onLock(picked)}>
              {picked ? action : blockedAction}
            </Button>
          </>
        }
      />
    </Stack>
  )
}
