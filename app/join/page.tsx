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
 * The one thing it does await is the wall beside the form, resolved here for
 * the same reason `/host` and `/` resolve theirs — the tiles arrive in the
 * first HTML at their final size, so nothing shifts when the media lands. It is
 * the same hour-cached `wallTiles()` call, so a guest who came past the front
 * door already has every one of these in cache.
 */
export default async function JoinPage() {

  return <JoinScreen />
}
