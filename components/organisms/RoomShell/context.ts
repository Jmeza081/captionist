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
}

const NOOP: RoomShellApi = { notify: () => {} }

export const RoomShellContext = createContext<RoomShellApi>(NOOP)

/**
 * Falls back to a no-op rather than throwing, so a screen can be rendered on
 * its own — in the gallery, or in a test — without a shell around it.
 */
export function useRoomShell(): RoomShellApi {
  return useContext(RoomShellContext)
}
