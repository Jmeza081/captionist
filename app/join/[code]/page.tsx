import type { Metadata } from 'next'
import { JoinScreen } from '@/components/organisms/JoinScreen'
import { CODE_PREFIX, normalizeCode } from '@/lib/game/codes'

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
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { code } = await params
  const normalized = normalizeCode(code)
  const body = normalized ? normalized.slice(CODE_PREFIX.length) : ''

  /**
   * Read here rather than with `useSearchParams` in the screen.
   *
   * `/join` — the codeless door — is a static route, and a client hook reading
   * search params would drag it into dynamic rendering for a flag it never
   * uses. This route is already dynamic, so the cost lands where the feature is.
   */
  const { auto } = await searchParams
  const queued = Number(Array.isArray(auto) ? auto[0] : auto)
  const autoJoin =
    process.env.NODE_ENV !== 'production' && Number.isInteger(queued) && queued >= 0
      ? queued
      : undefined

  return <JoinScreen initialCode={body} autoJoin={autoJoin} />
}
