import type { Metadata } from 'next'
import { JoinScreen } from '@/components/organisms/JoinScreen'

export const metadata: Metadata = {
  title: 'Join a room · Captionist',
}

/**
 * Typing a room code by hand.
 *
 * Nothing here asks a server about the *room*: the code is validated in the
 * browser by the same `normalizeCode` the room route uses, and whether a room
 * exists is a question only the transport can answer — which happens after the
 * push.
 *
 * **It awaits nothing.** The wall beside the form used to be resolved here, by
 * the same hour-cached `wallTiles()` call `/` and `/host` used. That call was a
 * server-side request against the provider's terms and it is gone: `HeroWall`
 * ships twenty `TvStatic` cells in the first HTML and resolves the real art in
 * the browser from committed slugs — see
 * [ADR 0025](../../docs/adr/0025-the-app-remembers-slugs-not-urls.md). The
 * cells are already at their final size, so nothing shifts when the media
 * lands, which is what the old arrangement was actually buying.
 */
export default async function JoinPage() {

  return <JoinScreen />
}
