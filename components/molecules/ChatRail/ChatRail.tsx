'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Avatar, AvatarOverflow } from '@/components/atoms/Avatar'
import { CloseButton } from '@/components/atoms/CloseButton'
import { Icon } from '@/components/atoms/Icon'
import { PresencePill } from '@/components/atoms/PresencePill'
import type { PlayerFace } from '@/lib/game/types'
import { DETENTS, useSheetDrag } from './useSheetDrag'
import styles from './ChatRail.module.scss'

export interface ChatRailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many players are in the room. */
  present: number
  /** Messages since you last looked. Badges the collapsed strip. */
  unread?: number
  /** Shown in the collapsed strip. The first three, then a +N chip. */
  players: PlayerFace[]
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
 * **The handle is draggable, and only on the sheet.** Drag it down once to
 * shrink chat to 42% so the round is readable behind it, again to dismiss;
 * drag or flick up to go back. The docked rail never sees any of it — a column
 * is not dragged anywhere — and the whole gesture is a shortcut for the two
 * controls that were already there, never the only way to reach either.
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
  toasts,
  children,
}: ChatRailProps) {
  // Hooks run before the collapsed branch, because the branch is a return and
  // React counts hooks per render. It costs the strip nothing: nothing is
  // subscribed and nothing fires until the handle is pressed.
  const sheet = useSheetDrag(() => onOpenChange(false))

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

  /**
   * The sheet's height, and the finger currently changing it.
   *
   * Custom properties rather than a height in the stylesheet, so the detents
   * live in one place — `useSheetDrag` — instead of being stated once in TS
   * for the gesture maths and again in Sass for the paint. Above `md` the
   * stylesheet overrides height outright and none of this is read.
   */
  const sizing = {
    '--sheet-max': `${DETENTS.tall * 100}dvh`,
    '--sheet-height': `${DETENTS[sheet.detent] * 100}dvh`,
    '--sheet-drag': `${sheet.offset}px`,
  } as CSSProperties

  return (
    <aside
      className={`${styles.rail} ${sheet.dragging ? styles.dragging : ''}`}
      style={sizing}
      aria-label="Room chat"
    >
      {/* A real control, not a bar with a listener bolted on: it resizes the
          sheet, so it has to be reachable without a pointer. Enter toggles the
          two heights, the arrows pick one outright, and the drag is the
          shortcut over the top of both. */}
      <button
        type="button"
        className={styles.grabber}
        onClick={sheet.toggle}
        aria-label={
          sheet.detent === 'tall' ? 'Shrink chat, or drag to resize' : 'Expand chat, or drag to resize'
        }
        {...sheet.handlers}
      >
        <span className={styles.grabberBar} aria-hidden="true" />
      </button>

      <header className={styles.head}>
        <span className={styles.title}>Room chat</span>
        <PresencePill count={present} />
        {/* A chevron points at the edge it collapses to, which on a sheet is
            nowhere — so the sheet gets the app's close key and the docked rail
            keeps its chevron. Both are rendered and CSS shows one, which is
            how the shape is matched without a media query in React; the hidden
            one leaves the accessibility tree with its `display`. */}
        <button
          type="button"
          className={styles.collapse}
          onClick={() => onOpenChange(false)}
          aria-label="Close chat"
        >
          <Icon name="chevronRight" size={15} />
        </button>
        <CloseButton
          className={styles.sheetClose}
          onClick={() => onOpenChange(false)}
          label="Close chat"
        />
      </header>

      <div className={styles.body}>{children}</div>
    </aside>
  )
}
