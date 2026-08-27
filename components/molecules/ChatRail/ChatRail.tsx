'use client'

import type { ReactNode } from 'react'
import { Avatar, AvatarOverflow, type AvatarProps } from '@/components/atoms/Avatar'
import { Icon } from '@/components/atoms/Icon'
import { PresencePill } from '@/components/atoms/PresencePill'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import styles from './ChatRail.module.scss'

type RailPlayer = Pick<AvatarProps, 'name' | 'color' | 'src'>

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
  /** The message list and composer. */
  children?: ReactNode
}

/** The collapsed strip shows this many avatars before the overflow chip. */
const STACK_LIMIT = 3

/**
 * Room chat, docked beside the content.
 *
 * Never modal and never over the content — it docks, and overlays sit above
 * both. Collapses to a 64px strip that keeps the unread count, the reaction
 * affordance and who's here.
 */
export function ChatRail({
  open,
  onOpenChange,
  present,
  unread = 0,
  players,
  onReact,
  children,
}: ChatRailProps) {
  if (!open) {
    const shown = players.slice(0, STACK_LIMIT)
    const extra = players.length - shown.length

    return (
      <aside className={styles.strip} aria-label="Room chat, collapsed">
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
      <header className={styles.head}>
        <span className={styles.title}>Room chat</span>
        <PresencePill count={present} />
        <button
          type="button"
          className={styles.collapse}
          onClick={() => onOpenChange(false)}
          aria-label="Collapse chat"
        >
          <Icon name="chevronRight" size={15} />
        </button>
      </header>

      <div className={styles.body}>{children}</div>
    </aside>
  )
}
