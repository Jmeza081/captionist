import { describe, expect, it } from 'vitest'
import { lobbyFixture } from '@/lib/game/fixtures'
import { project } from '@/lib/game/project'
import { createRoomStore, isSeated } from './store'

/**
 * `isSeated` is the predicate the boot's two independent paths agree on: it
 * decides when `RoomShell` hands the room over, and it decides whether a
 * refusal is a failed join or a mid-game snackbar. They live in different files
 * and neither calls the other, so the thing worth testing is that the predicate
 * itself says what both of them think it says.
 */

const seated = (selfId: string) => {
  const store = createRoomStore(selfId, false)
  store.setState(project(lobbyFixture({ players: 5 }), selfId))
  return isSeated(store.getSnapshot())
}

describe('isSeated', () => {
  it('is false before any broadcast', () => {
    // The old gate. A room with no state is unambiguous — nobody is in it yet.
    expect(isSeated(createRoomStore('p0', false).getSnapshot())).toBe(false)
  })

  it('is false for a room that exists without you in it', () => {
    // **The case the old `!state` gate got wrong.** A first broadcast proves a
    // room exists and nothing more; a guest still has to ask for a seat. Handing
    // over here drew a lobby whose roster was missing its own viewer.
    expect(seated('p9')).toBe(false)
  })

  it('is true once your seat is in the roster', () => {
    expect(seated('p2')).toBe(true)
  })

  it('is true for a host on their first broadcast', () => {
    // `createRoom` seats the host, so the host never waits on this — which is
    // what lets one predicate serve both roles instead of branching on `isHost`.
    expect(seated('p0')).toBe(true)
  })

  it('stays true for a seat that is only reconnecting', () => {
    // A held seat is still a seat. Reading `connection` here would put a
    // dropped guest back on the boot screen mid-game, behind the reconnect
    // overlay that is the actual answer to being disconnected.
    const store = createRoomStore('p2', false)
    const state = project(lobbyFixture({ players: 5 }), 'p2')
    store.setState({
      ...state,
      players: state.players.map((player) =>
        player.id === 'p2' ? { ...player, connection: 'reconnecting' as const } : player,
      ),
    })
    expect(isSeated(store.getSnapshot())).toBe(true)
  })
})

describe('the boot channel', () => {
  it('starts on the role it was told to expect', () => {
    // Seeded from intent, because nobody knows who hosts until the election
    // resolves — see `intendedRole` in `RoomProvider`.
    expect(createRoomStore('p0', false, 'host').getSnapshot().boot).toEqual({
      stage: 'probing',
      role: 'host',
    })
  })

  it('merges a patch rather than replacing the progress', () => {
    const store = createRoomStore('p0', false, 'host')
    store.setBoot({ stage: 'claiming' })
    expect(store.getSnapshot().boot).toEqual({ stage: 'claiming', role: 'host' })
  })

  it('keeps the snapshot referentially stable when nothing changed', () => {
    // The store's whole contract: React 19 re-reads `getSnapshot` during render
    // and loops forever on a fresh object. Every other setter is guarded, and a
    // merging one is the easiest of them to get wrong.
    const store = createRoomStore('p0', false, 'guest')
    store.setBoot({ stage: 'claiming' })
    const before = store.getSnapshot()
    store.setBoot({ stage: 'claiming' })
    expect(store.getSnapshot()).toBe(before)
  })
})
