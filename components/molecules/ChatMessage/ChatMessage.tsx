import type { ReactNode } from 'react'
import { Avatar, type AvatarProps } from '@/components/atoms/Avatar'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import styles from './ChatMessage.module.scss'

export interface ChatMessageProps {
  author: Pick<AvatarProps, 'name' | 'color' | 'src'>
  body: string
  /** Already formatted for reading — "2:14", not a timestamp. */
  time: string
  /** A GIF the player attached, rendered at 180×120. */
  attachment?: { src: string; alt: string }
  /** Reaction tallies under the body. */
  tallies?: ReactNode
  /**
   * A host announcement. Replaces the whole row with an accent card — it is
   * the room speaking, not a player.
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
  tallies,
  announcement = false,
}: ChatMessageProps) {
  if (announcement) {
    return (
      <div className={styles.announcement}>
        <span className={styles.announceIcon}>
          <Icon name="send" size={13} />
        </span>
        <div className={styles.announceBody}>
          <Eyebrow>{author.name} · host</Eyebrow>
          <p className={styles.announceText}>{body}</p>
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
        </div>

        <p className={styles.body}>{body}</p>

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
