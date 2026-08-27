'use client'

import { createContext, useContext } from 'react'

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
}

const NOOP: RoomShellApi = { notify: () => {}, openHelp: () => {} }

export const RoomShellContext = createContext<RoomShellApi>(NOOP)

/**
 * Falls back to a no-op rather than throwing, so a screen can be rendered on
 * its own — in the gallery, or in a test — without a shell around it.
 */
export function useRoomShell(): RoomShellApi {
  return useContext(RoomShellContext)
}
