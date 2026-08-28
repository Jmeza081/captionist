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
  /** A GIF the player attached, rendered at 180×120. */
  attachment?: { src: string; alt: string }
  /**
   * The caption this message answers.
   *
   * Content, never authorship — the grid is anonymous until the reveal, and a
   * name here would hand back what `project()` strips.
   */
  replyTo?: { src?: string; caption: string }
  /** Reaction tallies under the body. */
  tallies?: ReactNode
  /**
   * Opens the reaction picker aimed at *this* message.
   *
   * Optional because the gallery draws a message with no room behind it — and
   * because an announcement has no affordance. Without it, chat reactions could
   * only ever land on whatever arrived last, which is what they did until now.
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
 * Host announcements are the same component with `announcement`, because they
 * occupy the same slot in the same list — a sibling component would drift.
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
      className={styles.react}
      onClick={onReact}
      // Not the default "Add a reaction": a log of twenty messages would hand a
      // screen reader twenty controls with one name.
      aria-label={`React to ${author.name}'s message`}
    />
  )

  if (announcement) {
    return (
      <div className={styles.announcement}>
        <span className={styles.announceIcon}>
          <Icon name="send" size={13} />
        </span>
        <div className={styles.announceBody}>
          <div className={styles.meta}>
            {/* The room's own host is named "Host", and "HOST · HOST" reads as
                a bug whether or not it is one. */}
            <Eyebrow>
              {author.name.toLowerCase() === 'host' ? 'host' : `${author.name} · host`}
            </Eyebrow>
            {react}
          </div>
          {body && <p className={styles.announceText}>{body}</p>}
          {/* An announcement can carry a picture and can be reacted to, same as
              any other line. Drawing only the body is what made a host's GIF an
              empty purple card. */}
          {attachment && (
            <div className={styles.attachment}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote
                  animated GIF; next/image would rasterise it. */}
              <img src={attachment.src} alt={attachment.alt} />
            </div>
          )}
          {tallies && <div className={styles.tallies}>{tallies}</div>}
        </div>
      </div>
    )
  }

  return (
    <article className={styles.message}>
      <Avatar {...author} size={30} />

      <div className={styles.content}>
        <div className={styles.meta}>
          <span className={styles.name}>{author.name}</span>
          <time className={styles.time}>{time}</time>
          {react}
        </div>

        {body && <p className={styles.body}>{body}</p>}

        {/* After the body, the way the design draws it: you read what someone
            said, then what they said it about. */}
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

        {attachment && (
          <div className={styles.attachment}>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote
                animated GIF; next/image would rasterise it. */}
            <img src={attachment.src} alt={attachment.alt} />
          </div>
        )}

        {tallies && <div className={styles.tallies}>{tallies}</div>}
      </div>
    </article>
  )
}
