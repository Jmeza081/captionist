'use client'

import { useEffect, useRef, useState } from 'react'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import { TallyPill } from '@/components/atoms/TallyPill'
import { ChatMessage } from '@/components/molecules/ChatMessage'
import { Composer } from '@/components/molecules/Composer'
import { GifPanel } from '@/components/molecules/GifPanel'
import { ReactionToolbar } from '@/components/molecules/ReactionToolbar'
import { UnreadDivider } from '@/components/molecules/UnreadDivider'
import { playerById, toAvatarProps } from '@/lib/game/selectors'
import { useGifSearch } from '@/lib/gifs/useGifSearch'
import { labelFor, QUICK_REACTIONS, REACTIONS } from '@/lib/reactions'
import type { EventSnapshot, Tally } from '@/lib/room/events'
import { tallyKey } from '@/lib/room/events'
import type { ChatAttachment } from '@/lib/room/transport'
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
 * A union rather than two booleans, so DESIGNSYSTEM rule 3 — "one overlay
 * surface at a time" — holds by construction: there is no state in which both
 * are open, so nobody has to remember to call the other setter. `RoomShell`
 * models its own overlays the same way.
 *
 * A staged attachment is deliberately *not* a member: it is a pending payload,
 * not a surface, and it has to survive the panel that produced it closing.
 */
type Surface = 'reactions' | 'gifs' | null

export function ChatPanel() {
  const { state } = useRoom()
  const messages = useChatLog()
  const unread = useUnread()
  const tallies = useEventSelector(selectTallies)
  const { say, react } = useChat()
  const { replyTo, clearReply } = useRoomShell()

  const [draft, setDraft] = useState('')
  const [surface, setSurface] = useState<Surface>(null)
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>(undefined)
  const listRef = useRef<HTMLDivElement>(null)
  const gifs = useGifSearch()

  // Pinned to the bottom, the way a live room wants. Keyed on the count rather
  // than the array so opening the picker does not yank the view.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length])

  if (!state) return null

  /** What a one-tap reaction or the picker lands on: the newest message. */
  const newest = messages[messages.length - 1]

  const composer = (
    <div className={styles.foot}>
      {surface === 'reactions' && newest && (
        <div className={styles.picker}>
          <ReactionToolbar
            title={`React to ${playerById(state, newest.from)?.name ?? 'this'}`}
            reactions={[...REACTIONS]}
            flipped
            onPick={(reaction) => {
              react('message', newest.id, reaction.glyph)
              setSurface(null)
            }}
          />
        </div>
      )}

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => {
          // A GIF alone is a message, so this fires on either. `say` and
          // `receiveChat` agree on that rule; the button already did.
          say(draft, { attachment, replyTo })
          setDraft('')
          setAttachment(undefined)
          clearReply()
          setSurface(null)
        }}
        quickReactions={QUICK_REACTIONS.map((r) => ({ id: r.id, glyph: r.glyph, label: r.label }))}
        onQuickReact={(id) => {
          const glyph = QUICK_REACTIONS.find((r) => r.id === id)?.glyph
          if (newest && glyph) react('message', newest.id, glyph)
        }}
        // Nothing to react to in an empty room, so the affordance is absent
        // rather than present and inert — a dead control is worse than none.
        onReact={newest ? () => setSurface((open) => (open === 'reactions' ? null : 'reactions')) : undefined}
        onAttachGif={() => setSurface((open) => (open === 'gifs' ? null : 'gifs'))}
        attachment={attachment}
        onClearAttachment={() => setAttachment(undefined)}
        replyTo={replyTo}
        onClearReply={clearReply}
        panel={
          surface === 'gifs' ? (
            <GifPanel
              variant="popover"
              results={gifs.results}
              status={gifs.status}
              message={gifs.message}
              query={gifs.query}
              onQueryChange={() => {}}
              onSubmit={gifs.search}
              onPick={(gif) => {
                // Picking stages, never sends — the message goes on the send
                // key like any other, so a GIF can still carry words.
                setAttachment({ src: gif.src, alt: gif.alt })
                setSurface(null)
              }}
              onClose={() => setSurface(null)}
            />
          ) : null
        }
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
          const author = playerById(state, entry.from)
          // A message from somebody who has since left keeps its text — the
          // room heard it — but has no face to draw with.
          const props = author
            ? toAvatarProps(author)
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
                // The host addressing the room is an announcement, not a chat
                // line. Same slot, same list, same component with a flag —
                // a sibling would have drifted by the second change.
                announcement={author?.isHost === true}
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
