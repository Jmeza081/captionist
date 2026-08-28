import type { Metadata } from 'next'
import { JoinScreen } from '@/components/organisms/JoinScreen'

export const metadata: Metadata = {
  title: 'Join a room · Captionist',
}

/**
 * Typing a room code by hand.
 *
 * Static: nothing here needs a server. The code is validated in the browser by
 * the same `normalizeCode` the room route uses, and whether a room exists is a
 * question only the transport can answer — which happens after the push.
 */
export default function JoinPage() {
  return <JoinScreen />
}
