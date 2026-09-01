import { Avatar } from '@/components/atoms/Avatar'
import { Icon } from '@/components/atoms/Icon'
import styles from './ChatToast.module.scss'
import type { PlayerFace } from '@/lib/game/types'

export interface ChatToastProps {
  author: PlayerFace
  body: string
  /**
   * The room speaking, not a player — the toast half of `ChatMessage`'s accent
   * card, and the reason a mode switch reaches somebody with the rail shut.
   *
   * It drops the face and the name rather than drawing a synthetic one: an
   * avatar here would say a *person* told you, and the whole point of the
   * accent treatment is that nobody did.
   */
  announcement?: boolean
}

/**
 * One arriving message, while chat is shut.
 *
 * Not a `Snackbar`: that one is the room's single centred voice for something
 * the *player* just did, and it carries no author. A toast is somebody else
 * talking, so it needs a face and a name, and it stacks.
 *
 * Decorative in the accessibility sense — the message is already announced by
 * the log's live region, so narrating it twice would double every line.
 */
export function ChatToast({ author, body, announcement = false }: ChatToastProps) {
  return (
    <div
      className={`${styles.toast} ${announcement ? styles.announcement : ''}`}
      aria-hidden="true"
    >
      {announcement ? (
        <span className={styles.icon}>
          <Icon name="send" size={12} />
        </span>
      ) : (
        <>
          <Avatar {...author} size={26} />
          <span className={styles.who}>{author.name}</span>
        </>
      )}
      <span className={styles.body}>{body}</span>
    </div>
  )
}

export interface ChatToastOverflowProps {
  count: number
}

/** "2 more in chat" — the cap, so a stack never walks up over the timer. */
export function ChatToastOverflow({ count }: ChatToastOverflowProps) {
  return (
    <div className={styles.overflow} aria-hidden="true">
      {count} more in chat
    </div>
  )
}
