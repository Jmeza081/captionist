/**
 * The reactions you reached for last, kept on this browser.
 *
 * `localStorage`, deliberately, and none of the three alternatives:
 *
 * - **not the event store**, whose contract is one event off the wire — this
 *   never travels, and a room full of people does not share a Recent tab;
 * - **not `GameState`**, which would bump `rev` every time somebody tapped an
 *   emoji, on the number guests drop stale game updates against;
 * - **not `sessionStorage`**, which the room snapshot uses because a room dies
 *   with its host. Your recent emoji should outlive the room.
 *
 * **Ids, not glyphs.** A retired tile then disappears from Recent instead of
 * rendering as a dead URL or a character nothing can name.
 */
import { REACTIONS } from './reactions'

const KEY = 'captionist:recent-reactions'

/** One grid's worth. More would scroll a tab whose whole job is to be quick. */
export const RECENT_MAX = 10

/**
 * What this browser has reached for, most recent first.
 *
 * Filtered against the current set on read, so a reaction removed from
 * `REACTIONS` leaves quietly rather than becoming a blank tile. Returns empty
 * rather than throwing when storage is unavailable — a private window, a
 * browser set to block site data, or the server, where there is no `window`.
 */
export function readRecent(): readonly string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const known = new Set(REACTIONS.map((r) => r.id))
    return parsed.filter((id): id is string => typeof id === 'string' && known.has(id))
  } catch {
    return []
  }
}

/** Moves one reaction to the front, deduped and capped. */
export function pushRecent(id: string): readonly string[] {
  const next = [id, ...readRecent().filter((existing) => existing !== id)].slice(0, RECENT_MAX)
  if (typeof window === 'undefined') return next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // A full or blocked store is not worth failing a reaction over.
  }
  return next
}
