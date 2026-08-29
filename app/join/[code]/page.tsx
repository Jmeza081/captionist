import type { Metadata } from 'next'
import { JoinScreen } from '@/components/organisms/JoinScreen'
import { CODE_PREFIX, normalizeCode } from '@/lib/game/codes'
import { wallTiles } from '@/lib/gifs/wall'

export const metadata: Metadata = {
  title: 'Join a room · Captionist',
}

/**
 * The link on the QR code, and the one a host reads out.
 *
 * Deliberately **not** a redirect straight into the room: a guest still needs a
 * name and a face before they can ask for a seat, so the code arrives prefilled
 * and the rest of the screen is the same one `/join` shows — wall included, for
 * the reason given there.
 *
 * A code that will not normalise is left in the field rather than 404ing —
 * `/room/[code]` may 404 because a malformed code cannot name a room, but here
 * the whole screen is the place to correct it.
 */
export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const normalized = normalizeCode(code)
  const body = normalized ? normalized.slice(CODE_PREFIX.length) : ''
  const tiles = await wallTiles()

  return <JoinScreen initialCode={body} tiles={tiles} />
}
