import { connectAbly } from './AblyTransport'
import { connectBroadcast, type BroadcastRole } from './BroadcastTransport'
import type { Levers } from './levers'
import type { RoomTransport } from './transport'
import { readSeatSignature, writeSeat } from './identity'
import type { PlayerId, RoomCode } from '@/lib/game/types'

/**
 * Which transport a room runs on.
 *
 * The roadmap promised phase 5 would change "exactly one line in
 * `RoomProvider`". It is one call, and this is the module behind it — the
 * decision is here rather than inline for the same reason `/api/gifs` resolves
 * its three switches inside the route: so nothing upstream has to know which
 * road it got.
 *
 * **A real room is Ably, and there is no fallback.** Giphy can serve offline
 * art because a picture is a picture; there is no offline stand-in for other
 * people. A room with no key does not quietly degrade to a transport that
 * cannot leave the browser — it says what to set.
 *
 * The exception is the test suite, which must run with no credentials and no
 * network. `ABLY_STUB=1` or `?transport=broadcast` selects the tab transport,
 * and that is the road every spec takes.
 */

export type TransportKind = 'ably' | 'broadcast'

/** A room that could not be built, with a sentence saying why. */
export class RoomUnavailable extends Error {}

export interface ConnectOptions {
  roomCode: RoomCode
  selfId: string
  role?: BroadcastRole
  levers: Levers
  /** Set when the token route says it has no key to mint with. */
  stubbed?: boolean
}

/**
 * Read the switches, in the order that lets a narrower one win.
 *
 * The URL lever beats the environment, so a single page load can be moved onto
 * the tab transport without restarting the server — the same relationship
 * `?gifs=stub` has with `GIFS_STUB`.
 */
export function transportKind(levers: Levers, stubbed: boolean): TransportKind {
  if (levers.transport) return levers.transport
  // **A deployed room never falls back.** Levers read as absent in production,
  // so without this a keyless deploy resolved `stubbed` and quietly ran a
  // transport that cannot leave the browser — every player alone in their own
  // room, with nothing on screen to say so. It fails loudly instead.
  if (process.env.NODE_ENV === 'production') return 'ably'
  return stubbed ? 'broadcast' : 'ably'
}

export async function connectRoom(options: ConnectOptions): Promise<RoomTransport> {
  const { roomCode, selfId, role, levers, stubbed = false } = options

  if (transportKind(levers, stubbed) === 'broadcast') {
    return connectBroadcast({ roomCode, selfId, role })
  }
  if (stubbed) {
    // Asked for Ably by a server that just said it cannot mint a token. Waiting
    // on a connection that will never authenticate is the one failure mode a
    // misconfigured server must not have — it looks exactly like a slow one.
    throw new RoomUnavailable(
      'Realtime isn’t configured, so this room can’t open. Set ABLY_API_KEY and restart the server.',
    )
  }
  return connectAbly({ roomCode, selfId, role })
}

/* ------------------------------------------------------------------ */
/* Asking the server what it can do                                    */
/* ------------------------------------------------------------------ */

export interface Realtime {
  /** The seat the server signed. Not necessarily the one we asked for. */
  seat: PlayerId
  /** True when there is no key, so the room falls to the tab transport. */
  stubbed: boolean
}

/**
 * One request, before the room is built, that answers two questions at once:
 * whether realtime is configured, and which seat this tab is allowed to be.
 *
 * They are the same request because they are the same fact — a server with no
 * key cannot sign a seat any more than it can mint a token, so asking twice
 * would only create a way for the two answers to disagree.
 *
 * An unreachable route is treated as "no realtime". In development that lands
 * on the tab transport — a smaller room than the one asked for, and still a
 * room. **In production it lands on an error**, because there the answer means
 * the deploy has no key and a room that cannot leave one browser is not a
 * smaller room, it is a broken one. See `transportKind`.
 */
export async function probeRealtime(roomCode: RoomCode, seat: PlayerId): Promise<Realtime> {
  const params = new URLSearchParams({ room: roomCode, seat })
  const signature = readSeatSignature()
  if (signature) params.set('sig', signature)

  try {
    const response = await fetch(`/api/ably/seat?${params.toString()}`, { cache: 'no-store' })
    if (!response.ok) return { seat, stubbed: true }
    const body = (await response.json()) as {
      seat?: string
      signature?: string
      stub?: boolean
    }
    if (body.seat && body.signature) {
      writeSeat(body.seat, body.signature)
      return { seat: body.seat, stubbed: body.stub === true }
    }
    return { seat, stubbed: true }
  } catch {
    return { seat, stubbed: true }
  }
}
