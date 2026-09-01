'use client'

import type { ReactNode } from 'react'
import { NOT_FOUND_SLUG } from '@/lib/gifs/art'
import { useResolvedOne } from '@/lib/gifs/useArt'
import type { GifResult } from '@/lib/gifs/types'
import { MediaCard } from './MediaCard'

/**
 * The 404's card, with its GIF upgraded in the browser.
 *
 * `/_not-found` is a prerendered Server Component, so whatever it renders is
 * baked at build time — and a provider's media URL may neither be fetched from
 * a server nor committed. So the page ships the app's own art and this swaps in
 * the real one once a client can ask for it.
 *
 * It owns the whole card rather than taking a render prop: a function cannot
 * cross the server/client boundary, and passing one turns the page into a 500.
 * Elements can cross, which is why `tallies` still comes from the page.
 */
export function ResolvedNotFoundMedia({
  fallback,
  topText,
  tallies,
}: {
  fallback: GifResult
  topText: string
  tallies: ReactNode
}) {
  const shown = useResolvedOne(NOT_FOUND_SLUG).gif ?? fallback
  return <MediaCard src={shown.src} alt={shown.alt} topText={topText} tallies={tallies} />
}
