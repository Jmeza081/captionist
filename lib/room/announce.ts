import { SEAT_GRACE_MS } from '@/lib/game/constants'
import { modeName, playerById } from '@/lib/game/selectors'
import type { GameState, PlayerFace, PlayerId } from '@/lib/game/types'
import type { AnnouncementBody } from './transport'

/**
 * What the room says about itself, and how it reads.
 *
 * Two halves of one idea, kept together: the rule that *produces* an
 * announcement and the words it turns into. Splitting them would put the
 * vocabulary in one file and its only meaning in another.
 *
 * It lives in `lib/room` rather than `lib/game` because `AnnouncementBody` is
 * wire vocabulary, and `lib/room → lib/game` is the allowed direction.
 */

/**
 * Derived from the *transition*, never from the action.
 *
 * One rule covers every road a change arrives by. `room/settingsChanged` from
 * the lobby's segmented control and `host/switchedMode` from the toolbox are
 * the same fact told twice, and a per-action emit would have needed one branch
 * each and grown a third the next time somebody added a road. Comparing the
 * before and after states cannot miss one.
 *
 * A player appearing in `after` and not in `before` is a join, and deliberately
 * gets no line: the roster already draws it, and twenty of them while a room
 * fills is noise on top of the screen that exists to show exactly that.
 */
export function roomAnnouncements(
  before: GameState,
  after: GameState,
): readonly AnnouncementBody[] {
  const out: AnnouncementBody[] = []

  if (before.settings.mode !== after.settings.mode) {
    out.push({ code: 'mode', mode: after.settings.mode })
  }

  for (const player of after.players) {
    const was = before.players.find((p) => p.id === player.id)
    if (!was) continue
    if (was.connection === 'online' && player.connection !== 'online') {
      out.push({ code: 'left', who: player.id })
    } else if (was.connection !== 'online' && player.connection === 'online') {
      out.push({ code: 'returned', who: player.id })
    }
  }

  return out
}

/**
 * The words, rendered where they are read rather than where they are sent.
 *
 * `state` resolves the name off the current roster, so somebody who changed
 * their nickname is not announced under an old one — and `selfId` is what lets
 * the line say "you", which §5 asks for wherever there is a person to address.
 */
export function announcementLine(
  body: AnnouncementBody,
  state: GameState,
  selfId: PlayerId,
): string {
  if (body.code === 'mode') return `New mode: ${modeName(body.mode)}.`

  const mine = body.who === selfId
  const name = playerById(state, body.who)?.name ?? 'Someone'

  if (body.code === 'returned') return mine ? 'You’re back.' : `${name} is back.`

  // The grace window is a promise, so it is read off the constant that keeps
  // it rather than written out — see the test that holds the two together.
  const seconds = Math.round(SEAT_GRACE_MS / 1_000)
  const held = `Seat held for ${seconds} seconds.`
  return mine ? `You dropped out. ${held}` : `${name} dropped out. ${held}`
}

/**
 * The face on an announcement — which is not a face.
 *
 * `ChatMessage`'s announcement branch draws no `Avatar`; it reads `author.name`
 * for the eyebrow and nothing else. Naming it "Room" is what makes the card say
 * what its own doc comment says it is — *the room speaking, not a player* — and
 * is why this is a constant rather than the host's props. Passing the host's
 * would be wrong twice: it re-creates the "HOST · HOST" eyebrow the prop's note
 * already rejects, and on a drop it credits the host with unplugging somebody
 * else's router.
 *
 * `color` is never read on that branch. It carries the same value the room's
 * other synthetic face uses so the two look alike if one ever is drawn.
 */
export const ROOM_FACE: PlayerFace = {
  name: 'Room',
  color: '#303031',
  avatarSeed: 'room',
}
