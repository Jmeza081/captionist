import * as Ably from 'ably'
import type { RoomCode } from '@/lib/game/types'

/**
 * The only place the Ably key is read from — and it is read *by the caller*.
 *
 * The key is passed in rather than pulled from the environment here, so this
 * module is a pure function of a credential: trivially testable, and impossible
 * to import into a client bundle with a live secret already baked in. Same
 * shape as `searchGiphy(query, apiKey)`, and for the same reason.
 */

export class AblyError extends Error {}

/** Every channel this room uses, and nothing else. */
export function roomCapability(roomCode: RoomCode): Record<string, Ably.capabilityOp[]> {
  // A glob, not an enumeration. Ably's own guidance is to grant a namespace
  // rather than list channels — a room with twenty per-recipient state channels
  // would otherwise put twenty keys in every token.
  return { [`captionist:${roomCode}:*`]: ['publish', 'subscribe', 'presence'] }
}

/** An hour is longer than a game and shorter than a working day. */
const TTL_MS = 60 * 60 * 1_000

/**
 * Sign a token request for one seat in one room.
 *
 * `createTokenRequest` rather than `requestToken`: it signs locally with the
 * key, so this route never makes a network call of its own. The browser
 * presents the signed request to Ably itself.
 */
export async function mintTokenRequest(
  clientId: string,
  roomCode: RoomCode,
  apiKey: string,
): Promise<Ably.TokenRequest> {
  try {
    const rest = new Ably.Rest({ key: apiKey })
    return await rest.auth.createTokenRequest({
      // Binding the id here is the whole security boundary: Ably stamps it onto
      // every message this client publishes, and refuses any other.
      clientId,
      capability: roomCapability(roomCode),
      ttl: TTL_MS,
    })
  } catch (error) {
    throw new AblyError(error instanceof Error ? error.message : 'token request failed')
  }
}
