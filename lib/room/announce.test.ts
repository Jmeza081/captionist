import { describe, expect, it } from 'vitest'
import { SEAT_GRACE_MS } from '@/lib/game/constants'
import { fixtureFor } from '@/lib/game/fixtures'
import type { GameState, PlayerId } from '@/lib/game/types'
import { announcementLine, roomAnnouncements } from './announce'

/**
 * What the room says about itself.
 *
 * The rule is a diff, so every case here is a *pair* of states — which is the
 * point: one rule covers every road a change arrives by, and a test that fed it
 * an action would be testing the road instead.
 */

const ROOM = fixtureFor('compose', { players: 5 })

function withConnection(
  state: GameState,
  id: PlayerId,
  connection: 'online' | 'reconnecting',
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, connection } : p)),
  }
}

describe('what the room announces', () => {
  it('says nothing when nothing it speaks about changed', () => {
    expect(roomAnnouncements(ROOM, { ...ROOM, rev: ROOM.rev + 1 })).toEqual([])
  })

  it('names a mode switch, whichever action carried it', () => {
    const after = { ...ROOM, settings: { ...ROOM.settings, mode: 'react' as const } }
    expect(roomAnnouncements(ROOM, after)).toEqual([{ code: 'mode', mode: 'react' }])
  })

  it('names a drop and a return', () => {
    const gone = withConnection(ROOM, 'p2', 'reconnecting')
    expect(roomAnnouncements(ROOM, gone)).toEqual([{ code: 'left', who: 'p2' }])
    expect(roomAnnouncements(gone, ROOM)).toEqual([{ code: 'returned', who: 'p2' }])
  })

  it('says nothing about somebody arriving — the roster already draws that', () => {
    const joined = {
      ...ROOM,
      players: [
        ...ROOM.players,
        {
          id: 'late',
          name: 'Roberto',
          color: '#fff',
          avatarSeed: 'fern',
          isHost: false,
          connection: 'online' as const,
          joinedAt: 0,
        },
      ],
    }
    expect(roomAnnouncements(ROOM, joined)).toEqual([])
  })

  it('names three drops in one presence sweep as three lines', () => {
    // A wifi router dying is one event to the transport and three facts to the
    // room. This is the case the chat rate limit would have eaten two of.
    let after = ROOM
    for (const id of ['p1', 'p2', 'p3']) after = withConnection(after, id, 'reconnecting')
    expect(roomAnnouncements(ROOM, after)).toHaveLength(3)
  })
})

describe('the words', () => {
  it('names the mode the room switched to', () => {
    expect(announcementLine({ code: 'mode', mode: 'react' }, ROOM, 'p0')).toBe(
      'New mode: React to the caption.',
    )
  })

  it('says "you" when it is you', () => {
    expect(announcementLine({ code: 'returned', who: 'p2' }, ROOM, 'p2')).toBe('You’re back.')
    expect(announcementLine({ code: 'returned', who: 'p2' }, ROOM, 'p0')).toMatch(/ is back\.$/)
  })

  it('promises the grace window the constant actually gives', () => {
    // Read off `SEAT_GRACE_MS` rather than written out, so changing the grace
    // cannot leave the room promising a number it no longer keeps.
    const line = announcementLine({ code: 'left', who: 'p2' }, ROOM, 'p0')
    expect(line).toContain(`Seat held for ${Math.round(SEAT_GRACE_MS / 1_000)} seconds.`)
  })

  it('falls back to a name rather than an id for somebody no longer listed', () => {
    expect(announcementLine({ code: 'left', who: 'ghost' }, ROOM, 'p0')).toMatch(/^Someone /)
  })
})
