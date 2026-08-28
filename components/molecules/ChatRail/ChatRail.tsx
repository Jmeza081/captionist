'use client'

import type { ReactNode } from 'react'
import { Avatar, AvatarOverflow, type AvatarProps } from '@/components/atoms/Avatar'
import { Icon } from '@/components/atoms/Icon'
import { PresencePill } from '@/components/atoms/PresencePill'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import styles from './ChatRail.module.scss'

type RailPlayer = Pick<AvatarProps, 'name' | 'color' | 'src' | 'avatarSeed'>

export interface ChatRailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many players are in the room. */
  present: number
  /** Messages since you last looked. Badges the collapsed strip. */
  unread?: number
  /** Shown in the collapsed strip. The first three, then a +N chip. */
  players: RailPlayer[]
  onReact?: () => void
  /**
   * Incoming messages, shown beside the collapsed strip.
   *
   * A slot rather than a list, because what a toast looks like is chat's
   * business and where it sits is the rail's. They rise above the rail rather
   * than inside it — DESIGNSYSTEM.md's ladder puts toasts at 65 and the rail
   * at 40.
   */
  toasts?: ReactNode
  /** The message list and composer. */
  children?: ReactNode
}

/** The collapsed strip shows this many avatars before the overflow chip. */
const STACK_LIMIT = 3

/**
 * Room chat: a docked rail on a desktop, a sheet on a phone.
 *
 * Never modal and never over the content — it docks, and overlays sit above
 * both. Collapses to a 64px strip that keeps the unread count, the reaction
 * affordance and who's here.
 *
 * **Both sizes are one component, and the difference is entirely CSS.** A
 * phone cannot afford 360px of docked chat, so below `md` the same markup
 * becomes a sheet over the content and the strip becomes a single key above
 * the thumb. A sibling `ChatSheet` was the obvious shape and the wrong one:
 * the header, the stream and the composer are identical in both, so a second
 * component would be a copy of this one that drifts from it.
 */
export function ChatRail({
  open,
  onOpenChange,
  present,
  unread = 0,
  players,
  onReact,
  toasts,
  children,
}: ChatRailProps) {
  if (!open) {
    const shown = players.slice(0, STACK_LIMIT)
    const extra = players.length - shown.length

    return (
      <aside className={styles.strip} aria-label="Room chat, collapsed">
        {toasts && <div className={styles.toastDock}>{toasts}</div>}

        <button
          type="button"
          className={styles.openKey}
          onClick={() => onOpenChange(true)}
          aria-label={
            unread > 0
              ? `Open chat, ${unread} unread ${unread === 1 ? 'message' : 'messages'}`
              : 'Open chat'
          }
        >
          <Icon name="chat" size={18} />
          {unread > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {unread}
            </span>
          )}
        </button>

        {onReact && <ReactionCTA onClick={onReact} />}

        <span className={styles.stripRule} aria-hidden="true" />

        <div className={styles.stack}>
          {shown.map((p) => (
            <Avatar key={p.name} {...p} size={26} />
          ))}
          {extra > 0 && <AvatarOverflow count={extra} size={26} />}
        </div>

        <span className={styles.vertical} aria-hidden="true">
          Chat
        </span>
      </aside>
    )
  }

  return (
    <aside className={styles.rail} aria-label="Room chat">
      {/* The sheet's drag handle. Decorative — the close key is the real
          affordance, and it is reachable at both sizes. */}
      <span className={styles.grabber} aria-hidden="true" />

      <header className={styles.head}>
        <span className={styles.title}>Room chat</span>
        <PresencePill count={present} />
        <button
          type="button"
          className={styles.collapse}
          onClick={() => onOpenChange(false)}
          aria-label="Close chat"
        >
          {/* A chevron points at the edge it collapses to, which on a sheet is
              nowhere. Both are rendered and CSS shows one, so the icon matches
              the shape without a media query in React. */}
          <span className={styles.railIcon}>
            <Icon name="chevronRight" size={15} />
          </span>
          <span className={styles.sheetIcon}>
            <Icon name="close" size={15} />
          </span>
        </button>
      </header>

      <div className={styles.body}>{children}</div>
    </aside>
  )
}
