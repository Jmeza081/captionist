'use client'

import { useEffect, useMemo, useState } from 'react'
import { resolveArt } from './art'
import type { GifResult } from './types'

/**
 * The app's own chosen art, upgraded in the browser after the first paint.
 *
 * These surfaces — the landing wall, the waiting backdrop, the 404 — used to
 * render committed `media.giphy.com` URLs straight out of the first HTML.
 * Klipy's terms do not allow that: the API request has to come from a browser
 * and the media URL must not be retained. So the server renders the app's own
 * art, and this swaps in the real thing once it arrives. See `art.ts`.
 *
 * **The fallback is never removed.** It is what a visitor sees first, what they
 * keep if there is no key, no network, or a spent allowance, and what the
 * Playwright suite sees — it resolves no host but the dev server, so a wall
 * that depended on a live fetch would be twenty broken tiles. Nothing here
 * throws and nothing here shows a spinner: a landing page is not worth an error
 * state.
 */
export function useResolvedArt(slugs: readonly string[]): GifResult[] | undefined {
  const [art, setArt] = useState<GifResult[] | undefined>(undefined)

  useEffect(() => {
    let live = true
    // State is set from the async continuation, never synchronously inside the
    // effect — the same rule `useGifSearch` follows for its arrival board.
    void resolveArt(slugs).then((found) => {
      if (live && found.length > 0) setArt(found)
    })
    return () => {
      live = false
    }
    // The slug lists are module constants, so this runs once per mount.
  }, [slugs])

  return art
}

/**
 * One named GIF, or nothing. The single-item case of `useResolvedArt`.
 *
 * The array is memoised because it is the hook's dependency: a fresh `[slug]`
 * every render would re-run the effect every render, which is one API call per
 * render rather than one per mount.
 */
export function useResolvedOne(slug: string): GifResult | undefined {
  const slugs = useMemo(() => [slug], [slug])
  return useResolvedArt(slugs)?.[0]
}
