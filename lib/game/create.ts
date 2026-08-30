import { asHatId } from '@/lib/hats'
import { DEFAULT_SETTINGS, PLAYER_COLORS } from './constants'
import type { GameState, HatId, Player, RoomCode, RoomSettings } from './types'

export interface CreateRoomInput {
  roomCode: RoomCode
  host: { id: string; name: string; avatarSeed: string; hat?: HatId }
  settings?: Partial<RoomSettings>
  seed: number
  at: number
}

/**
 * The one place a `GameState` is built from nothing.
 *
 * Kept out of the reducer because it needs values the reducer is not allowed
 * to invent — a room code and a seed both come from `Math.random` at the edge.
 */
export function createRoom(input: CreateRoomInput): GameState {
  const host: Player = {
    id: input.host.id,
    name: input.host.name,
    color: PLAYER_COLORS[0] ?? '#FF787D',
    // Narrowed like every other seat's — see `reducer.ts`.
    hat: asHatId(input.host.hat),
    avatarSeed: input.host.avatarSeed,
    isHost: true,
    connection: 'online',
    joinedAt: input.at,
  }
  return {
    roomCode: input.roomCode,
    hostId: host.id,
    createdAt: input.at,
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
    players: [host],
    phase: 'lobby',
    clock: { status: 'idle' },
    roundNumber: 0,
    roleHolderIndex: 0,
    round: null,
    history: [],
    seed: input.seed,
    rev: 1,
  }
}
