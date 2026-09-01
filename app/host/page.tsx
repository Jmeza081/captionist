import type { Metadata } from 'next'
import { HostSetupScreen } from '@/components/organisms/HostSetupScreen'

export const metadata: Metadata = {
  title: 'Set up a room · Captionist',
}

/**
 * Where a game's rules are decided, before the room exists.
 *
 * It asks no server for a code: under ADR 0003 the host's browser *is* the
 * server, so `generateCode` in the click handler is the whole of it.
 *
 * **It awaits nothing.** The wall beside the form used to be resolved here, by
 * an hour-cached `wallTiles()` call shared with `/`. That call was a
 * server-side request against the provider's terms and it is gone: `HeroWall`
 * ships twenty `TvStatic` cells in the first HTML and resolves the real art in
 * the browser from committed slugs — see
 * [ADR 0025](../../docs/adr/0025-the-app-remembers-slugs-not-urls.md). The
 * cells are already at their final size, so nothing shifts when the media
 * lands, which is what the old arrangement was actually buying.
 */
export default async function HostPage() {

  return <HostSetupScreen />
}
