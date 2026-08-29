import type { ReactNode } from 'react'
import { Avatar, type AvatarProps } from '@/components/atoms/Avatar'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import styles from './ChatMessage.module.scss'

export interface ChatMessageProps {
  author: Pick<AvatarProps, 'name' | 'color' | 'src' | 'avatarSeed'>
  body: string
  /** Already formatted for reading — "2:14", not a timestamp. */
  time: string
  /** A GIF the player attached, bounded by 180×120. */
  attachment?: { src: string; alt: string }
  /**
   * The caption this message answers.
   *
   * Content, never authorship — the grid is anonymous until the reveal, and a
   * name here would hand back what `project()` strips.
   */
  replyTo?: { src?: string; caption: string }
  /** Reaction tallies, in the row under the bubble. */
  tallies?: ReactNode
  /**
   * Opens the reaction picker aimed at *this* message.
   *
   * Optional because the gallery draws a message with no room behind it.
   * Without it, chat reactions could only ever land on whatever arrived last,
   * which is what they did until now.
   */
  onReact?: () => void
  /**
   * A host announcement. Replaces the whole row with an accent card — it is
   * the room speaking, not a player.
   *
   * **Nothing sets this in the room today, deliberately.** `ChatPanel` used to
   * pass `author.isHost`, which made every line the host typed an accent card
   * signed "HOST · HOST" — and since this branch drew only the body, a GIF from
   * the host was an empty one. The host is a player ([ADR
   * 0004](../../../docs/adr/0004-the-host-is-not-a-special-case.md)); their
   * chat is chat. An announcement is a thing you *do*, and until there is an
   * action for it this prop is the gallery's and a future feature's.
   */
  announcement?: boolean
}

/**
 * One message in the room chat.
 *
 * Three bands, and the separation is the point: the **name row** labels it, the
 * **bubble** is what was said, and the **reaction row** underneath is what the
 * room did about it. Everything a message carries — body, quote, attachment —
 * goes inside the one plate, so a GIF with a caption reads as a single object
 * rather than as two things that happen to be stacked.
 *
 * Host announcements are the same component with `announcement`, because they
 * occupy the same slot in the same list — a sibling component would drift. The
 * accent card is its own plate, so it takes the avatar gutter too.
 */
export function ChatMessage({
  author,
  body,
  time,
  attachment,
  replyTo,
  tallies,
  onReact,
  announcement = false,
}: ChatMessageProps) {
  const react = onReact && (
    <ReactionCTA
      onClick={onReact}
      // Not the default "Add a reaction": a log of twenty messages would hand a
      // screen reader twenty controls with one name.
      aria-label={`React to ${author.name}'s message`}
    />
  )

  // An empty plate is not a message. A Slackmoji posted from the composer
  // arrives as a bare attachment and a caption-less reply cannot happen, but
  // the bubble should never draw for nothing at all.
  const hasBubble = Boolean(body || replyTo || attachment)

  const picture = attachment && (
    <div className={styles.attachment}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote
          animated GIF; next/image would rasterise it. */}
      <img src={attachment.src} alt={attachment.alt} />
    </div>
  )

  const reactions = (tallies || react) && (
    <div className={styles.reactions}>
      {tallies}
      {react}
    </div>
  )

  if (announcement) {
    return (
      <div className={styles.announcement}>
        <span className={styles.announceIcon}>
          <Icon name="send" size={13} />
        </span>
        <div className={styles.announceBody}>
          {/* The room's own host is named "Host", and "HOST · HOST" reads as a
              bug whether or not it is one. */}
          <Eyebrow>
            {author.name.toLowerCase() === 'host' ? 'host' : `${author.name} · host`}
          </Eyebrow>
          {body && <p className={styles.announceText}>{body}</p>}
          {/* An announcement can carry a picture and can be reacted to, same as
              any other line. Drawing only the body is what made a host's GIF an
              empty purple card. */}
          {picture}
          {reactions}
        </div>
      </div>
    )
  }

  return (
    <article className={styles.message}>
      <div className={styles.meta}>
        <span className={styles.name}>{author.name}</span>
        <time className={styles.time}>{time}</time>
      </div>

      {/* Wrapped because `Avatar` takes no `className` — and it stays that way,
          since a face is a face wherever it is placed. */}
      <span className={styles.face}>
        <Avatar {...author} size={30} />
      </span>

      <div className={styles.content}>
        {hasBubble && (
          <div className={styles.bubble}>
            {body && <p className={styles.body}>{body}</p>}

            {/* After the body, the way the design draws it: you read what
                someone said, then what they said it about. */}
            {replyTo && (
              <div className={styles.quote}>
                {replyTo.src && (
                  /* eslint-disable-next-line @next/next/no-img-element -- the
                     round's own art, already remote and animated. */
                  <img className={styles.quoteThumb} src={replyTo.src} alt="" />
                )}
                <div className={styles.quoteBody}>
                  <Eyebrow tone="muted">Replying to</Eyebrow>
                  <span className={styles.quoteCaption}>{replyTo.caption}</span>
                </div>
              </div>
            )}

            {picture}
          </div>
        )}

        {reactions}
      </div>
    </article>
  )
}
