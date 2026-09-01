'use client'

import { useEffect, useRef, useState } from 'react'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import { TallyPill } from '@/components/atoms/TallyPill'
import { ChatMessage } from '@/components/molecules/ChatMessage'
import { Composer } from '@/components/molecules/Composer'
import type { ComposerAttachment } from '@/components/molecules/Composer'
import { GifPanel } from '@/components/molecules/GifPanel'
import { ReactionToolbar } from '@/components/molecules/ReactionToolbar'
import { UnreadDivider } from '@/components/molecules/UnreadDivider'
import { playerById, toAvatarProps } from '@/lib/game/selectors'
import { announcementLine, ROOM_FACE } from '@/lib/room/announce'
import { useGifSearch } from '@/lib/gifs/useGifSearch'
import {
  isImageGlyph,
  labelFor,
  QUICK_REACTIONS,
  REACTIONS,
  type Reaction,
} from '@/lib/reactions'
import type { EventSnapshot, Tally } from '@/lib/room/events'
import { tallyKey } from '@/lib/room/events'
import { ROOM_TARGET } from '@/lib/room/transport'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { useChat, useChatLog, useEventSelector, useRoom, useUnread } from '@/lib/room/useRoom'
import styles from './ChatPanel.module.scss'

/**
 * The room's chat, inside the rail.
 *
 * An organism rather than a molecule because it composes four of them and
 * reads the room. `ChatRail` is only the container and has no idea what a
 * message is, which is exactly what lets one rail hold this at both
 * breakpoints.
 *
 * **Nothing here is game state.** The log comes from the event store, so a
 * message never bumps `rev`, never re-broadcasts the room, and the reducer
 * never sees one.
 */

/** Wall clock, the way the design writes it: "2:14". */
function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Every tally in the room, in one subscription.
 *
 * A per-message `useTallies` would be a hook inside a list, which React
 * forbids. Reading the whole record once and indexing it per row costs one
 * subscription for the entire log.
 */
const selectTallies = (snapshot: EventSnapshot) => snapshot.tallies

/**
 * Which surface is open above the composer.
 *
 * A union rather than three booleans, so DESIGNSYSTEM rule 3 — "one overlay
 * surface at a time" — holds by construction: there is no state in which two
 * are open, so nobody has to remember to call the other setter. `RoomShell`
 * models its own overlays the same way. Adding the GIF panel back cost nothing
 * here for exactly that reason.
 *
 * The reaction surface carries *what it is aimed at* rather than being a bare
 * flag: a message you picked, or — when `messageId` is null — the composer,
 * which posts. Holding the target in the surface is what stops the picker
 * quietly landing on whatever arrived last. The GIF surface aims at nothing:
 * it stages, and the send key decides.
 */
type Surface = { kind: 'reactions'; messageId: string | null } | { kind: 'gif' } | null

export function ChatPanel() {
  const { state, selfId } = useRoom()
  const messages = useChatLog()
  const unread = useUnread()
  const tallies = useEventSelector(selectTallies)
  const { say, react } = useChat()
  const { replyTo, clearReply } = useRoomShell()

  const [draft, setDraft] = useState('')
  const [surface, setSurface] = useState<Surface>(null)
  const [attachment, setAttachment] = useState<ComposerAttachment | undefined>(undefined)
  const listRef = useRef<HTMLDivElement>(null)

  /**
   * The picker, mounted only while it is open.
   *
   * This is the whole reason chat may have one again. ADR-0021 removed it
   * because `ChatPanel` fetched on mount, so every player in the room spent an
   * API call on joining whether or not they ever opened it. `enabled` makes
   * the cost follow the tap instead — which stays the right shape now that a
   * production key means nobody is counting (ADR-0026).
   */
  const gifs = useGifSearch({ enabled: surface?.kind === 'gif' })

  // Pinned to the bottom, the way a live room wants. Keyed on the count rather
  // than the array so opening the picker does not yank the view.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length])

  if (!state) return null

  /**
   * An emoji from the composer is a message, and the room hears it twice.
   *
   * The composer's keys used to fire a room reaction and leave no trace in the
   * log, which read as a chat control that silently did something else. They
   * post now — an emoji on its own is a complete thing to say — and the burst
   * rides along, because a room full of 🔥 in the stream and a still screen
   * would be the same disconnect the other way round.
   */
  const postReaction = (reaction: Reaction) => {
    // **A picture is an attachment, not a sentence.** An image tile's glyph is
    // a URL, and `say`'s text lands in the body verbatim — so a Slackmoji
    // posted as words rendered `/media/slackmoji-lgtm.svg` in 14px type. The
    // lane already carries pictures; this is one.
    if (isImageGlyph(reaction.glyph)) {
      say('', { attachment: { src: reaction.glyph, alt: reaction.label } })
    } else {
      say(reaction.glyph)
    }
    react('room', ROOM_TARGET, reaction.glyph)
  }

  /**
   * A reaction aimed at one message.
   *
   * Leaves a tally on that message *and* fires the room's burst — the event
   * store already bumps `lastReaction` for every target, because a laugh in
   * chat is still the room laughing.
   */
  const reactToMessage = (messageId: string, glyph: string) => {
    react('message', messageId, glyph)
  }

  /** Which message the open picker is aimed at, or null for the composer. */
  const pickingAt = surface?.kind === 'reactions' ? surface.messageId : null

  const pickerTitle = (messageId: string | null) => {
    if (!messageId) return 'Send an emoji'
    const entry = messages.find((m) => m.id === messageId)
    const author = entry && playerById(state, entry.from)
    return `React to ${author?.name ?? 'this'}`
  }

  const composer = (
    <div className={styles.foot}>
      <div className={styles.picker}>
        <ReactionToolbar
          open={surface?.kind === 'reactions'}
          title={pickerTitle(pickingAt)}
          reactions={[...REACTIONS]}
          flipped
          onPick={(reaction) => {
            if (pickingAt) reactToMessage(pickingAt, reaction.glyph)
            else postReaction(reaction)
            setSurface(null)
          }}
          /*
            Only closes the picker it was opened for.

            The outside-click listener fires after React's own handler for the
            same click, so a tap on another message's CTA would otherwise open
            that surface and then immediately have this close it. Comparing against the target this picker was showing
            leaves a surface somebody else has just opened alone.
          */
          onDismiss={() =>
            setSurface((cur) =>
              cur?.kind === 'reactions' && cur.messageId === pickingAt ? null : cur,
            )
          }
        />
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => {
          say(draft, { replyTo, attachment })
          setDraft('')
          setAttachment(undefined)
          clearReply()
          setSurface(null)
        }}
        quickReactions={QUICK_REACTIONS.map((r) => ({ id: r.id, glyph: r.glyph, label: r.label }))}
        onQuickReact={(id) => {
          const picked = QUICK_REACTIONS.find((r) => r.id === id)
          if (picked) postReaction(picked)
        }}
        /*
          Always offered, never inert — and now it always does the same thing,
          whatever is in the log. It used to aim at whichever message arrived
          last, so the same key meant "tally that" or "shout at the room"
          depending on timing nobody could see.
        */
        onReact={() =>
          setSurface((open) =>
            open?.kind === 'reactions' ? null : { kind: 'reactions', messageId: null },
          )
        }
        onAttachGif={() =>
          setSurface((open) => (open?.kind === 'gif' ? null : { kind: 'gif' }))
        }
        attachment={attachment}
        onClearAttachment={() => setAttachment(undefined)}
        panel={
          surface?.kind === 'gif' ? (
            <GifPanel
              variant="popover"
              results={gifs.results}
              status={gifs.status}
              message={gifs.message}
              /*
                Controlled, and searched by the provider rather than filtered
                here. That is not a preference: `GifPanel` narrows a fixed list
                locally when it is handed one, and doing that to a provider's
                results is the client-side filtering both of them forbid. The
                `provider` prop is what turns it off — see the note on `shown`.
              */
              query={gifs.query}
              onQueryChange={gifs.setQuery}
              onSubmit={gifs.search}
              onMore={gifs.more}
              provider={gifs.descriptor}
              onClose={() => setSurface(null)}
              onPick={(gif) => {
                // Klipy's attribution depends on hearing that a GIF was
                // chosen, and a message is as much a use of their media as a
                // caption is. Said here because it is the last moment the id
                // still exists.
                gifs.chose(gif)
                setAttachment({ src: gif.src, alt: gif.alt })
                setSurface(null)
              }}
            />
          ) : undefined
        }
        replyTo={replyTo}
        onClearReply={clearReply}
      />
    </div>
  )

  if (messages.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <p>Nobody has said anything yet.</p>
        </div>
        {composer}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/*
        `role="log"` carries an implicit polite live region, so an arriving
        message is announced when the screen reader is idle instead of cutting
        across the countdown. Never `assertive`: chat is not urgent; the clock
        is.
      */}
      <div className={styles.log} ref={listRef} role="log" aria-label="Room chat">
        {messages.map((entry) => {
          // The room speaking, not a player. No face, no reaction target and no
          // divider above it: the unread run is a thing to react to and reply
          // in, and an announcement is neither.
          if (entry.kind === 'announcement') {
            return (
              <div key={entry.id} className={styles.row}>
                <ChatMessage
                  announcement
                  author={ROOM_FACE}
                  body={announcementLine(entry.body, state, selfId)}
                  time={clockTime(entry.at)}
                />
              </div>
            )
          }

          const author = playerById(state, entry.from)
          // A message from somebody who has since left keeps its text — the
          // room heard it — but has no face to draw with.
          const props = author
            ? toAvatarProps(state, author)
            : { name: 'Someone who left', color: '#303031', avatarSeed: entry.from }
          const own: readonly Tally[] = tallies[tallyKey('message', entry.id)] ?? []

          return (
            <div key={entry.id} className={styles.row}>
              {unread.firstId === entry.id && unread.count > 0 && (
                <UnreadDivider count={unread.count} />
              )}

              <ChatMessage
                author={props}
                body={entry.text}
                time={clockTime(entry.at)}
                attachment={entry.attachment}
                replyTo={entry.replyTo}
                onReact={() =>
                  setSurface((open) =>
                    open?.kind === 'reactions' && open.messageId === entry.id
                      ? null
                      : { kind: 'reactions', messageId: entry.id },
                  )
                }
                tallies={
                  own.length > 0
                    ? own.map((tally) => (
                        <TallyPill
                          key={tally.emoji}
                          glyph={<ReactionGlyph glyph={tally.emoji} />}
                          count={tally.count}
                          mine={tally.mine}
                          context="chat"
                          label={labelFor(tally.emoji)}
                        />
                      ))
                    : undefined
                }
              />
            </div>
          )
        })}
      </div>

      {composer}
    </div>
  )
}
