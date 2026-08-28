import { describe, expect, it } from 'vitest'
import { CAPTION_MAX, HOST_FALLBACK_NAME, PROMPT_MAX, SEAT_GRACE_MS } from './constants'
import { fixtureFor, lobbyFixture } from './fixtures'
import { reduce } from './reducer'
import {
  briefCopy,
  lobbyCopy,
  ballotFrom,
  captionFields,
  clearLabel,
  lockGateFrom,
  modeChoices,
  settingsSummary,
  showsCaptionFormat,
  myRoundPlacement,
  ordinal,
  podiumCopy,
  presentCount,
  seatSecondsLeft,
  seatState,
  rankSlotCount,
  revealCopy,
  scoreCopy,
  showsRoundProgress,
  standings,
  tiebreakCards,
  tiebreakCopy,
  voteCards,
  voteCopy,
  waitingCopy,
  captionRemaining,
  composeCopy,
  phaseLabel,
  promptRemaining,
  showsProgressRail,
  startLabel,
  submittedLine,
  timerSuffix,
} from './selectors'
import type { GameMode } from './types'

const brief = (mode: GameMode) => fixtureFor('brief', { players: 5, settings: { mode } })
const compose = (mode: GameMode) => fixtureFor('compose', { players: 5, settings: { mode } })

/**
 * `p0` is the host *and* round one's role holder — `beginRound` takes
 * `players[roleHolderIndex]` and both start at zero. So the setup faces belong
 * to `p0` and the competing faces to anyone else, which is the whole reason
 * `?as=` exists.
 */
const HOLDER = 'p0'
const RIVAL = 'p1'

describe('the header', () => {
  it('names the step you are on, not the phase the room is in', () => {
    expect(phaseLabel(brief('caption'), HOLDER)).toBe('Round 1 of 5')
    expect(phaseLabel(brief('react'), HOLDER)).toBe('Round 1 of 5 · Write the prompt')
    expect(phaseLabel(compose('caption'), RIVAL)).toBe('Round 1 of 5 · Caption this')
    expect(phaseLabel(compose('react'), RIVAL)).toBe('Round 1 of 5 · Answer the prompt')
  })

  it('gives one phase two headers, depending on who is looking', () => {
    const state = compose('caption')
    // The same room, the same instant: one player writes, the other watches.
    expect(phaseLabel(state, RIVAL)).toBe('Round 1 of 5 · Caption this')
    expect(phaseLabel(state, HOLDER)).toBe('Round 1 of 5')
  })

  it('has no phase label in the lobby, where the settings line goes instead', () => {
    expect(phaseLabel(lobbyFixture(), HOLDER)).toBeUndefined()
  })

  it('says what the clock is counting down to', () => {
    expect(timerSuffix(brief('caption'), HOLDER)).toBe('to pick')
    expect(timerSuffix(brief('react'), HOLDER)).toBe('to write')
    expect(timerSuffix(compose('caption'), RIVAL)).toBe('left')
    // You are not the one on a deadline, so the design shows a bare 0:24.
    expect(timerSuffix(brief('caption'), RIVAL)).toBe('')
  })

  it('drains the rail on the compose phases only', () => {
    expect(showsProgressRail(compose('caption'))).toBe(true)
    expect(showsProgressRail(brief('caption'))).toBe(false)
    expect(showsProgressRail(lobbyFixture())).toBe(false)
  })
})

describe('the lobby CTA', () => {
  it('counts the room when it can start', () => {
    expect(startLabel(lobbyFixture({ players: 5 }))).toBe('Start game — 5 players ready')
  })

  it('says what is missing when it cannot, rather than going quiet', () => {
    expect(startLabel(lobbyFixture({ players: 1 }))).toBe('Start game — need 2 more')
    expect(startLabel(lobbyFixture({ players: 2 }))).toBe('Start game — need 1 more')
  })
})

describe('screen copy', () => {
  it('addresses the role holder by name and everyone else about them', () => {
    expect(briefCopy(brief('caption'), HOLDER).eyebrow).toBe('You’re up, Jesse')
    expect(briefCopy(brief('caption'), RIVAL).headline).toBe('Jesse is scrolling Giphy.')
    expect(briefCopy(brief('react'), RIVAL).headline).toBe('Jesse is typing a prompt.')
  })

  it('branches the mode without the screen ever asking which one it is', () => {
    expect(briefCopy(brief('caption'), HOLDER).action).toBe('Lock it in')
    expect(briefCopy(brief('react'), HOLDER).action).toBe('Send it to the room')
    expect(composeCopy(compose('caption'), RIVAL).action).toBe('Submit caption')
    expect(composeCopy(compose('react'), RIVAL).action).toBe('Lock in my answer')
  })

  it('gives the role holder a compose screen the design never drew', () => {
    const copy = composeCopy(compose('caption'), HOLDER)
    expect(copy.view).toBe('watch')
    expect(copy.action).toBeUndefined()
    expect(copy.headline).toBe('They’re captioning your pick.')
  })

  it('counts submissions against the competitors, not the room', () => {
    // Five players, one of them setting the round up.
    expect(submittedLine(compose('caption'))).toBe('0 of 4 have submitted')
    expect(submittedLine(fixtureFor('waiting', { players: 5 }))).toBe('4 of 4 have submitted')
  })
})

describe('the counters', () => {
  it('measures a caption against 60 and a prompt against 90', () => {
    expect(captionRemaining('')).toBe(CAPTION_MAX)
    expect(promptRemaining('')).toBe(PROMPT_MAX)
    expect(promptRemaining('me explaining the outage to leadership')).toBe(PROMPT_MAX - 38)
  })
})

/* ------------------------------------------------------------------ */
/* Phase 3                                                             */
/* ------------------------------------------------------------------ */

const at = (phase: Parameters<typeof fixtureFor>[0], mode: GameMode) =>
  fixtureFor(phase, { players: 5, settings: { mode } })

describe('ordinals', () => {
  it('handles the teens, which are the ones that break naive rules', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
    ])
  })
})

describe('the waiting screen', () => {
  it('names the thing you locked in, per mode', () => {
    expect(waitingCopy(at('waiting', 'caption')).eyebrow).toBe('Submitted')
    expect(waitingCopy(at('waiting', 'react')).eyebrow).toBe('Answer locked')
  })

  it('does not promise an edit it cannot offer', () => {
    // The design's "Edit my caption" is deliberately not built — phase is
    // room-wide, so a guest cannot rewind to `compose`. The copy has to match.
    for (const mode of ['caption', 'react'] as const) {
      expect(waitingCopy(at('waiting', mode)).body).not.toMatch(/edit|swap/i)
    }
  })
})

describe('the vote screen', () => {
  it('explains the scoring the same way in both modes, and the exclusion once', () => {
    expect(voteCopy(at('vote', 'caption')).subline).toContain('3 points for first')
    expect(voteCopy(at('vote', 'caption')).subline).toContain('your own')
    expect(voteCopy(at('vote', 'react')).subline).toContain('anonymous until the reveal')
  })

  it('never asks for more places than the room has entries', () => {
    // Three players is two entries, so a voter who wrote one can rank exactly
    // one. Asking for three would be a gate nobody could pass.
    const small = fixtureFor('vote', { players: 3 })
    expect(rankSlotCount(small, RIVAL)).toBe(1)
    expect(lockGateFrom(small, RIVAL, 0)).toEqual({ ok: false, label: 'Pick 1 more' })
    expect(lockGateFrom(small, RIVAL, 1)).toEqual({ ok: true })
  })

  it('counts down what is still missing', () => {
    const state = at('vote', 'caption')
    expect(lockGateFrom(state, RIVAL, 0)).toEqual({ ok: false, label: 'Pick 3 more' })
    expect(lockGateFrom(state, RIVAL, 2)).toEqual({ ok: false, label: 'Pick 1 more' })
    expect(lockGateFrom(state, RIVAL, 3)).toEqual({ ok: true })
  })
})

describe('a single-vote room', () => {
  const single = () => fixtureFor('vote', { players: 5, settings: { voting: 'single' } })

  it('asks for one pick and promises one point', () => {
    // The setting was offered in `HostSetupScreen` long before any screen read
    // it, so every one of these read as a rank-3 room.
    const copy = voteCopy(single())
    expect(copy.heading).toBe('Pick the best one.')
    expect(copy.subline).toContain('1 point')
    expect(copy.subline).not.toContain('3 points for first')
    expect(copy.picksLabel).toBe('Your pick')
    expect(copy.lockAction).toBe('Lock my pick')
  })

  it('names the clear button rather than the place it frees', () => {
    // "Clear 2nd" names a place. One slot has no place to name, and composing
    // that branch in the screen is the copy fork this file exists to prevent.
    expect(clearLabel(single(), 1)).toBe('Clear pick')
    expect(clearLabel(at('vote', 'caption'), 2)).toBe('Clear 2nd')
  })

  it('draws one slot however many entries the room has', () => {
    // Five players is four entries, so the ranking arithmetic would say three.
    // The setting is the cap, not the arithmetic.
    expect(rankSlotCount(single(), RIVAL)).toBe(1)
    expect(lockGateFrom(single(), RIVAL, 0)).toEqual({ ok: false, label: 'Pick one' })
    expect(lockGateFrom(single(), RIVAL, 1)).toEqual({ ok: true })
  })

  it('builds the ballot the room actually scores', () => {
    // Both callers — the screen and `fixtures.ts` — hardcoded `kind: 'rank'`,
    // so a one-long ranking paid `RANK_POINTS[0]` (3) in a room whose label
    // promised one point.
    const rank = at('vote', 'caption')
    const ids = voteCards(rank, RIVAL).filter((c) => !c.own).map((c) => c.entryId)

    expect(ballotFrom(rank, ids.slice(0, 3))).toEqual({ kind: 'rank', ranked: ids.slice(0, 3) })
    expect(ballotFrom(single(), ids.slice(0, 1))).toEqual({ kind: 'single', choice: ids[0] })
    expect(ballotFrom(rank, [])).toBeUndefined()
  })

  it('keeps the ring on the card a cast single vote named', () => {
    // `voteCards` read only the `rank` ballot kind, so locking a single vote
    // used to clear the grid: no ring, and an empty slot above it.
    const state = single()
    const target = voteCards(state, RIVAL).find((c) => !c.own)
    expect(target).toBeDefined()

    const cast = reduce(state, {
      type: 'round/ballotCast',
      actor: RIVAL,
      at: 1_700_000_200_000,
      ballot: { kind: 'single', choice: target?.entryId ?? '' },
    })

    expect(voteCards(cast, RIVAL).find((c) => c.entryId === target?.entryId)?.rank).toBe(1)
  })
})

describe('the caption format', () => {
  it('writes two lines by default and one when the room asks for one', () => {
    // `ComposeScreen` never read this setting, so "One line" was a live
    // control that changed nothing but a summary label.
    const two = captionFields(fixtureFor('compose', { players: 5 }))
    expect(two.map((f) => f.label)).toEqual(['Top text', 'Bottom text'])

    const one = captionFields(
      fixtureFor('compose', { players: 5, settings: { format: 'one' } }),
    )
    expect(one).toHaveLength(1)
    expect(one[0]?.label).toBe('Caption')
    expect(one[0]?.primary).toBe(true)
  })
})

describe('the tiebreak', () => {
  it('names both contenders, because a duel cannot be anonymous', () => {
    const state = at('tiebreak', 'caption')
    const cards = tiebreakCards(state, RIVAL)
    expect(cards).toHaveLength(2)
    for (const card of cards) expect(card.author?.name).toBeTruthy()
    expect(tiebreakCopy(state).exclusionLine).toContain('own duel')
  })

  it('names the role that breaks a persisting deadlock', () => {
    expect(tiebreakCopy(at('tiebreak', 'caption')).body).toContain('Captionist')
    expect(tiebreakCopy(at('tiebreak', 'react')).body).toContain('Prompter')
  })

  it('marks a contender out of their own duel', () => {
    const state = at('tiebreak', 'caption')
    const mine = tiebreakCards(state, RIVAL).filter((c) => c.own)
    // `p1` authored one of the two tied entries in this fixture.
    expect(mine.length).toBeLessThanOrEqual(1)
  })
})

describe('the reveal', () => {
  it('calls it a legend when it is you and a monster when it is not', () => {
    const state = at('reveal', 'caption')
    const result = state.history[state.history.length - 1]
    const winner = result ? result.authorOf[result.winnerEntryId] : undefined
    expect(winner).toBeTruthy()
    if (!winner) return
    expect(revealCopy(state, winner).headline).toContain('you legend.')
    const other = state.players.find((p) => p.id !== winner)
    if (other) expect(revealCopy(state, other.id).headline).toContain('you monster.')
  })

  it('names the round in the mode’s own words', () => {
    expect(revealCopy(at('reveal', 'caption'), HOLDER).eyebrow).toContain('winner')
    expect(revealCopy(at('reveal', 'react'), HOLDER).eyebrow).toContain('best answer')
  })

  it('tells everyone who submitted where they came', () => {
    const state = at('reveal', 'caption')
    expect(myRoundPlacement(state, RIVAL)).toMatch(/^You finished \d+(st|nd|rd|th) this round$/)
    // The role holder sat the round out, so they have no placement to report.
    expect(myRoundPlacement(state, HOLDER)).toBeUndefined()
  })
})

describe('the scoreboard', () => {
  it('says who is next, in the mode’s own role name', () => {
    expect(scoreCopy(at('score', 'caption')).nextRoleLine).toContain('Next captionist:')
    expect(scoreCopy(at('score', 'react')).nextRoleLine).toContain('Next prompter:')
  })

  it('turns the advance into a coronation on the last round', () => {
    const last = fixtureFor('score', { players: 5, settings: { totalRounds: 1 } })
    expect(scoreCopy(last).action).toBe('Crown the winner')
    expect(scoreCopy(last).nextRoleLine).toBe('Last round done')
  })

  it('reports rounds won once there are any, and this round otherwise', () => {
    const rows = standings(at('score', 'caption'))
    for (const row of rows) {
      expect(row.note).toMatch(/^(\d+ rounds? won|\+\d+ this round)$/)
    }
    // The pips only belong on the scoreboard.
    expect(showsRoundProgress(at('score', 'caption'))).toBe(true)
    expect(showsRoundProgress(at('vote', 'caption'))).toBe(false)
  })
})

describe('the podium', () => {
  it('crowns somebody and counts their points once', () => {
    const state = at('podium', 'caption')
    const copy = podiumCopy(state)
    expect(copy.headline).toMatch(/ takes the crown\.$/)
    expect(copy.gameOverLabel).toBe('Game over · 5 rounds')
    expect(copy.body).toMatch(/^\d+ points?, \d+ rounds? won, and zero remorse\.$/)
  })

  it('keeps the eyebrow in both modes — the role rotates, the product does not', () => {
    expect(podiumCopy(at('podium', 'caption')).eyebrow).toBe('Captionist of the sprint')
    expect(podiumCopy(at('podium', 'react')).eyebrow).toBe('Captionist of the sprint')
  })
})

describe('the guest lobby', () => {
  it('names the host, and says "the host" when they never gave a name', () => {
    const state = fixtureFor('lobby', { players: 5 })
    // The fixture names its host, so a guest hears it.
    expect(lobbyCopy(state, RIVAL).body).toMatch(/^Jesse is still herding/)
    expect(lobbyCopy(state, RIVAL).heading).toBe('You’re in, Jesska.')

    // A room reached without passing through `/host` has a nameless host, and
    // "You is still herding the rest of the team" is what naming them "You" got.
    const nameless = {
      ...state,
      players: state.players.map((p) => (p.isHost ? { ...p, name: HOST_FALLBACK_NAME } : p)),
    }
    expect(lobbyCopy(nameless, RIVAL).body).toMatch(/^The host is still herding/)
  })

  it('still asks the host whether everybody is in', () => {
    const state = fixtureFor('lobby', { players: 5 })
    expect(lobbyCopy(state, HOLDER).heading).toBe('Everybody in?')
    // And with no viewer at all — the host's own screen before phase 4.
    expect(lobbyCopy(state).heading).toBe('Everybody in?')
  })

  it('shows the rules a guest cannot change', () => {
    const rows = settingsSummary(fixtureFor('lobby', { players: 5 }))
    expect(rows.map((r) => r.label)).toEqual(['Rounds', 'Caption time', 'Format', 'Voting'])
    expect(rows.map((r) => r.value)).toEqual(['5', '90 sec', 'Top + bottom', 'Rank your top 3'])
  })
})

describe('the setup screen', () => {
  it('drops the caption format when there are no captions to format', () => {
    expect(showsCaptionFormat('caption')).toBe(true)
    expect(showsCaptionFormat('react')).toBe(false)
  })

  it('marks the chosen mode and names the other one', () => {
    const [classic, reversed] = modeChoices('react')
    expect(classic?.tag).toBe('Classic')
    expect(reversed?.tag).toBe('Selected')
  })
})

describe('presence', () => {
  const dropped = (state: ReturnType<typeof lobbyFixture>, id: string, at: number) =>
    reduce(state, { type: 'player/left', at, actor: id })

  it('counts people, not seats', () => {
    const state = lobbyFixture({ players: 5 })
    expect(presentCount(state)).toBe(5)

    // A drop holds the seat on purpose — a mid-round disconnect must not
    // destroy a submission — so the roster keeps counting them and the pill
    // used to say "5 here" to an empty room.
    const after = dropped(state, RIVAL, 1_700_000_100_000)
    expect(after.players).toHaveLength(5)
    expect(presentCount(after)).toBe(4)
  })

  it('holds the seat until the grace runs out, then gives up on it', () => {
    const at = 1_700_000_100_000
    const state = dropped(lobbyFixture({ players: 5 }), RIVAL, at)
    const player = state.players.find((p) => p.id === RIVAL)
    expect(player).toBeDefined()
    if (!player) return

    expect(seatState(player, at)).toBe('reconnecting')
    expect(seatState(player, at + SEAT_GRACE_MS - 1)).toBe('reconnecting')
    // `'gone'` is the one connection state no action produces: it is not
    // something that happens to a player, it is a deadline passing.
    expect(seatState(player, at + SEAT_GRACE_MS)).toBe('gone')
  })

  it('counts the seconds left the way the overlay says it does', () => {
    const at = 1_700_000_100_000
    const state = dropped(lobbyFixture({ players: 5 }), RIVAL, at)
    const player = state.players.find((p) => p.id === RIVAL)
    if (!player) return

    expect(seatSecondsLeft(player, at)).toBe(60)
    expect(seatSecondsLeft(player, at + 22_000)).toBe(38)
    expect(seatSecondsLeft(player, at + SEAT_GRACE_MS + 5_000)).toBe(0)
  })

  it('gives the seat back on a return', () => {
    const at = 1_700_000_100_000
    const left = dropped(lobbyFixture({ players: 5 }), RIVAL, at)
    const back = reduce(left, { type: 'player/reconnected', at: at + 5_000, actor: RIVAL })
    const player = back.players.find((p) => p.id === RIVAL)
    if (!player) return

    expect(seatState(player, at + 10_000)).toBe('online')
    expect(presentCount(back)).toBe(5)
  })
})

describe('a room that ended with its host', () => {
  it('says what happened instead of showing a scoreboard with no reason', () => {
    // `host/left` lands on the podium — the room lives in the host's browser
    // and goes when they do (ADR 0003). Until this, a guest saw final standings
    // mid-game with nothing to explain them.
    const mid = fixtureFor('score', { players: 5 })
    const ended = reduce(mid, { type: 'host/left', at: 1_700_000_200_000, actor: HOLDER })

    expect(ended.phase).toBe('podium')
    const copy = podiumCopy(ended)
    expect(copy.eyebrow).toBe('The host left')
    expect(copy.gameOverLabel).toMatch(/^Ended early · round 1 of 5$/)
    // No host means nothing to restart, so the way on is a new room.
    expect(copy.actionHref).toBe('/host')
  })

  it('still crowns a champion when the game actually finished', () => {
    const copy = podiumCopy(fixtureFor('podium', { players: 5 }))
    expect(copy.eyebrow).toBe('Captionist of the sprint')
    expect(copy.actionHref).toBeUndefined()
  })
})
