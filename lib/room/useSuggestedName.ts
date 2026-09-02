'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
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

/**
 * The nickname field: this tab's suggestion, and whatever you typed over it.
 *
 * The pair used to be two `useState` lines in each of the two front doors, and
 * both carried the same hydration hole. The field is server-rendered empty —
 * `SERVER` above, because a random name generated during render is a mismatch —
 * so between first paint and hydration there is a real, focusable input on
 * screen that React has not adopted yet. Type into it in that window and the
 * first client render writes the suggestion over what is in the box: somebody
 * who typed "Vic" quickly joined as "Blameless_DeployVic".
 *
 * The fix is to adopt rather than overwrite. `attach` is a callback ref, which
 * React runs as it commits the hydration — before the store's client snapshot
 * has replaced the empty one — so it sees the box exactly as the person left
 * it. Anything in there is theirs and wins.
 *
 * A callback ref rather than a `useRef` object on purpose: a ref read during
 * render is the thing `react-hooks/refs` forbids, and it is right to. This
 * never reads one — and it returns its three parts as a tuple rather than an
 * object so that nothing at the call site *looks* like reading one either.
 */
export function useNicknameField(): readonly [
  name: string,
  attach: (node: HTMLInputElement | null) => void,
  onChange: (value: string) => void,
] {
  const suggested = useSuggestedName()
  const [typed, setTyped] = useState<string | undefined>(undefined)

  const attach = useCallback((node: HTMLInputElement | null) => {
    // `??` and not a plain assignment: this fires again on every remount, and
    // a later one must not undo what has been typed since.
    if (node?.value) setTyped((current) => current ?? node.value)
  }, [])

  return [typed ?? suggested, attach, setTyped] as const
}
