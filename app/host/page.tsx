import type { Metadata } from 'next'
import { HostSetupScreen } from '@/components/organisms/HostSetupScreen'

export const metadata: Metadata = {
  title: 'Set up a room · Captionist',
}

/**
 * Where a game's rules are decided, before the room exists.
 *
 * Static, and it asks no server for a code: under ADR 0003 the host's browser
 * *is* the server, so `generateCode` in the click handler is the whole of it.
 */
export default function HostPage() {
  return <HostSetupScreen />
}
