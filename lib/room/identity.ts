import { AVATAR_SEEDS } from '@/lib/avatar'
import type { HatId, PlayerId } from '@/lib/game/types'
import { asHatId } from '@/lib/hats'

/**
 * Who this tab is playing as.
 *
 * Split across two storages, and the split is the whole point:
 *
 * - **The person is `localStorage`** — nickname and face, shared by every tab,
 *   so filling them in once is enough and the next room remembers you.
 * - **The seat is `sessionStorage`** — per-tab, minted once, kept across
 *   reloads of *that* tab. It has to be per-tab because two tabs of one browser
 *   are the two players phase 4 exists to seat, and an id they shared would put
 *   them both in the same chair: the host would address its own broadcast to
 *   itself and the guest would wait forever on a room that thought it had
 *   already spoken. It has to survive a reload because a reload is how a dropped
 *   player comes back, and `player/reconnected` only finds the seat that left.
 *
 * Nothing here is authority. The host decides what a player may do; this is
 * only what the tab calls itself when it asks.
 */

const PERSON_KEY = 'captionist:identity'
const SEAT_KEY = 'captionist:seat'
const SEAT_SIG_KEY = 'captionist:seat-sig'

/** The design's own placeholder, from the setup artboard's nickname field. */
export const DEFAULT_NICKNAME = 'TheCaptionist109'

export interface Identity {
  id: PlayerId
  name: string
  /**
   * Dicebear input. The seed travels in `GameState`; the rendered art never
   * does — see the no-data-URI invariant in `lib/game/types.ts`.
   */
  avatarSeed: string
  /**
   * The hat, if they picked one.
   *
   * Remembered with the face rather than suggested with the name: a hat is a
   * thing you chose, and the reason a nickname is drawn fresh per tab does not
   * apply — two tabs wearing the same hat are still told apart by their faces.
   * Absent *is* the default, which is why this needs no fallback literal.
   */
  hat?: HatId
}

/**
 * A room-unique id that is not a seat number.
 *
 * `p0`/`p1` are positions the *fixtures* hand out; a real player needs an id
 * nobody else will pick, because the reducer appends whatever it is given and
 * does not de-duplicate. `crypto.randomUUID` where it exists, and a
 * timestamp-plus-noise fallback for the older Safari the design's phone users
 * are on.
 */
function freshId(): PlayerId {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `u-${uuid.slice(0, 8)}`
  return `u-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

/** The person: nickname, face and hat, shared by every tab in this browser. */
export function readIdentity(): Pick<Identity, 'name' | 'avatarSeed' | 'hat'> | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(PERSON_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const candidate = parsed as Partial<Identity>
    if (typeof candidate.name !== 'string' || typeof candidate.avatarSeed !== 'string') {
      return undefined
    }
    // Narrowed, not trusted — `localStorage` is editable, and a hat id becomes
    // a URL. A bad hat costs the hat and never the face, so this drops the
    // field rather than rejecting the whole person.
    return {
      name: candidate.name,
      avatarSeed: candidate.avatarSeed,
      hat: asHatId(candidate.hat),
    }
  } catch {
    // Private mode, a quota wall, or something else's key under ours. A person
    // we cannot read is the same as one we never had.
    return undefined
  }
}

export function writeIdentity(person: Pick<Identity, 'name' | 'avatarSeed' | 'hat'>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PERSON_KEY, JSON.stringify(person))
  } catch {
    // Not being remembered costs you a retype, not a game.
  }
}

/**
 * The server's signature over this tab's seat.
 *
 * Presented back to `/api/ably/token` to reclaim the same chair. Meaningless to
 * us — we only carry it — but without it the server has no way to tell a
 * returning player from someone claiming their id, and `Intent.from` stops
 * meaning anything. See `lib/ably/seat.ts`.
 */
export function readSeatSignature(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.sessionStorage.getItem(SEAT_SIG_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** Adopt the seat the server signed, which may not be the one we asked for. */
export function writeSeat(seat: PlayerId, signature: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SEAT_KEY, seat)
    window.sessionStorage.setItem(SEAT_SIG_KEY, signature)
  } catch {
    // Without storage the seat lasts one page load, which costs a reconnect.
  }
}

/** This tab's seat. Minted once, then kept for as long as the tab lives. */
function ensureSeatId(): PlayerId {
  if (typeof window === 'undefined') return freshId()
  try {
    const stored = window.sessionStorage.getItem(SEAT_KEY)
    if (stored) return stored
    const minted = freshId()
    window.sessionStorage.setItem(SEAT_KEY, minted)
    return minted
  } catch {
    // Without storage the seat lasts one page load, which costs a reconnect.
    return freshId()
  }
}

/** The seat this tab plays under, wearing whatever face the browser remembers. */
export function ensureIdentity(): Identity {
  const person = readIdentity()
  return {
    id: ensureSeatId(),
    name: person?.name ?? '',
    avatarSeed: person?.avatarSeed ?? AVATAR_SEEDS[0] ?? 'ember',
    // No fallback: bare-headed is the default, so absent is already right.
    hat: person?.hat,
  }
}
