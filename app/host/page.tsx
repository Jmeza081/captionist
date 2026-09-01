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
 * The one thing it does await is the wall beside the form, resolved here for
 * the same reason the landing page resolves its own — the tiles arrive in the
 * first HTML at their final size, so nothing shifts when the media lands. It
 * is the same hour-cached `wallTiles()` call as `/`, so a host who came from
 * the front door already has every one of these in cache.
 */
export default async function HostPage() {

  return <HostSetupScreen />
}
