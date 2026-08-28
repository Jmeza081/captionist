'use client'

import { createContext, useContext } from 'react'
import type { ChatQuote } from '@/lib/room/transport'

/**
 * What a screen may ask of the chrome around it.
 *
 * Deliberately tiny. A screen owns its content column; anything that reaches
 * outside it — the one snackbar, the one open overlay — belongs to the shell,
 * and this is the whole of that contract.
 */
export interface RoomShellApi {
  /** Confirm an action that has no other visible result. DESIGNSYSTEM.md §4.2. */
  notify: (message: string) => void
  /**
   * Open the how-it-works walkthrough. The shell owns it because it is an
   * overlay, and only one of those may be open at a time — and because it must
   * never pause the room, whoever asks for it.
   */
  openHelp: () => void
  /**
   * The caption a chat message is about to answer.
   *
   * It lives here because it is raised in the content column and consumed in
   * the rail — which is exactly the "reaches outside it" test above. It is not
   * an overlay: it is a pending payload that has to survive the GIF panel and
   * the reaction picker opening over it, so it is not part of `ChatPanel`'s
   * one-surface union either.
   *
   * Not in the event store (whose contract is one event off the wire, and this
   * is unsent), not in `GameState` (it would bump `rev`), not in storage.
   */
  replyTo?: ChatQuote
  /** Stage a quote and open chat, so the answer has somewhere to go. */
  startReply: (quote: ChatQuote) => void
  clearReply: () => void
}

const NOOP: RoomShellApi = {
  notify: () => {},
  openHelp: () => {},
  startReply: () => {},
  clearReply: () => {},
}

export const RoomShellContext = createContext<RoomShellApi>(NOOP)

/**
 * Falls back to a no-op rather than throwing, so a screen can be rendered on
 * its own — in the gallery, or in a test — without a shell around it.
 */
export function useRoomShell(): RoomShellApi {
  return useContext(RoomShellContext)
}
