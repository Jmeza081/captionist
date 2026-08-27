import { notFound } from 'next/navigation'
import { normalizeCode } from '@/lib/game/codes'
import { RoomProvider } from '@/lib/room/RoomProvider'
import { RoomStateView } from './RoomStateView'

/**
 * One route for the whole room; the phase is a render switch inside it.
 *
 * A route per phase is rejected deliberately: transitions are host-pushed and
 * simultaneous for up to twenty clients, so each would be twenty `router.push`
 * calls that risk losing focus and scroll — and the back button would become a
 * time machine into a phase the room has already left.
 *
 * `params` and `searchParams` are Promises in Next 16.
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { code } = await params
  const search = await searchParams

  // `DEV` is the harness room. Anything else has to be a real, typo-tolerant code.
  const roomCode = code === 'DEV' ? 'C-DEV000' : normalizeCode(code)
  if (!roomCode) notFound()

  return (
    <RoomProvider roomCode={roomCode} search={search}>
      <RoomStateView />
    </RoomProvider>
  )
}
