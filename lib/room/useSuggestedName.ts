'use client'

import { useSyncExternalStore } from 'react'
import { suggestName } from '@/lib/names'

/**
 * This tab's suggested nickname, minted once and then held.
 *
 * Read through `useSyncExternalStore` for the same reason `useStoredPerson` is:
 * a random name generated during render is a value the server and the client
 * disagree about, which is a hydration mismatch. The server snapshot is the
 * empty string, the client's is one name, and React swaps them at hydration
 * without either side having lied.
 *
 * Minted at module scope, so it is one name per *page load* rather than one per
 * render: the field keeps its suggestion while you look at the face picker, and
 * a client-side hop from `/join` to `/host` carries the same one across. A new
 * tab reloads the module and draws again, which is the whole point — a name
 * kept in `localStorage` gave two tabs of one browser the same nickname and the
 * roster two players nobody could tell apart.
 */

const SERVER = ''

let minted: string | undefined

function getSnapshot(): string {
  minted ??= suggestName()
  return minted
}

/** Nothing changes it after the mint, so there is nothing to subscribe to. */
const subscribe = (): (() => void) => () => {}

export function useSuggestedName(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER)
}
