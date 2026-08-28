import type { RoomSettings } from '@/lib/game/types'

/**
 * What `/host` chose, on its way to the room it is about to open.
 *
 * The settings ride in `sessionStorage` rather than the URL. Seven of them
 * would make an unreadable query string on a screen whose whole job is a code
 * somebody reads out loud — and per-tab is right, because they belong to the
 * room this tab is opening rather than to the browser.
 *
 * Cleared on use: a later room started from the landing page must not silently
 * inherit the last host's rules.
 */

const KEY = 'captionist:settings'

export function writePendingSettings(settings: RoomSettings): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // The room falls back to `DEFAULT_SETTINGS`, which the design requires to
    // be playable as-is — so losing this costs a preference, not a game.
  }
}

export function readPendingSettings(): Partial<RoomSettings> | undefined {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Partial<RoomSettings>)
      : undefined
  } catch {
    return undefined
  }
}

export function clearPendingSettings(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to do: the next host overwrites it anyway.
  }
}
