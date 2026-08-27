import { describe, expect, it } from 'vitest'
import { CAPTION_MAX, PROMPT_MAX } from './constants'
import { fixtureFor, lobbyFixture } from './fixtures'
import {
  briefCopy,
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
