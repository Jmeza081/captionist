'use client'

import { useSyncExternalStore } from 'react'
import { AVATAR_SEEDS } from '@/lib/avatar'
import { readIdentity, type Identity } from './identity'

/**
 * The nickname and face this browser last used, for prefilling an entry screen.
 *
 * Read through `useSyncExternalStore` rather than an effect, and the reason is
 * the same one that shaped `lib/room/store.ts`: storage is an external system,
 * the server cannot see it, and setting state from an effect to fetch it is
 * both a cascading render and a hydration mismatch waiting to happen. The
 * server snapshot is empty, the client's is whatever was stored, and React
 * swaps them at hydration without either side lying.
 *
 * Screens layer what the person has typed *over* this rather than seeding state
 * from it — see `JoinScreen` — so the prefill arriving a beat late cannot clear
 * a field somebody is already using.
 */

export type StoredPerson = Pick<Identity, 'name' | 'avatarSeed'>

const SERVER: StoredPerson = { name: '', avatarSeed: AVATAR_SEEDS[0] ?? 'ember' }

/**
 * `getSnapshot` has to return a stable reference between real changes or React
 * re-enters its render loop — the same constraint the room store carries.
 */
let cached: StoredPerson = SERVER

function getSnapshot(): StoredPerson {
  const stored = readIdentity() ?? SERVER
  if (stored.name !== cached.name || stored.avatarSeed !== cached.avatarSeed) {
    cached = stored
  }
  return cached
}

/**
 * Nothing writes this while an entry screen is open — the only writer is the
 * submit handler on the way out — so there is nothing to subscribe to.
 */
const subscribe = (): (() => void) => () => {}

export function useStoredPerson(): StoredPerson {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER)
}
