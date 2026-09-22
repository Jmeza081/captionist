import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, PHASE_DURATIONS, durationFor } from './constants'
import type { RoomPhase, RoomSettings } from './types'

const timed: RoomSettings = { ...DEFAULT_SETTINGS, hostPaced: false }
const paced: RoomSettings = { ...DEFAULT_SETTINGS, hostPaced: true }

describe('durationFor', () => {
  it('defaults to a room that keeps its clocks', () => {
    // "Timers are honest" is a design-system rule, and the honest default is
    // that they exist. A host opts out; they do not opt in.
    expect(DEFAULT_SETTINGS.hostPaced).toBe(false)
  })

  it('resolves the compose cap from the setting, not the table', () => {
    expect(PHASE_DURATIONS.compose).toBeNull()
    expect(durationFor('compose', { ...timed, capSeconds: 90 })).toBe(90_000)
  })

  it('drops every deciding phase’s clock in a host-paced room', () => {
    const deciding: RoomPhase[] = ['brief', 'compose', 'waiting', 'vote', 'tiebreak']
    for (const phase of deciding) {
      expect(durationFor(phase, timed)).not.toBeNull()
      expect(durationFor(phase, paced)).toBeNull()
    }
  })

  it('takes precedence over the compose cap', () => {
    // The cap is the length of a clock that no longer runs. If this fell
    // through, a paced room would still time the one phase a host most wants
    // to hold open.
    expect(durationFor('compose', { ...paced, capSeconds: 180 })).toBeNull()
  })

  it('leaves the opener alone, because it is a beat and not a deadline', () => {
    // 3.8s of animation with nothing to decide in it. Holding it open would
    // make the host tap to get past a transition.
    expect(durationFor('opener', paced)).toBe(PHASE_DURATIONS.opener)
    expect(durationFor('opener', paced)).not.toBeNull()
  })

  it('changes nothing about the phases that were already untimed', () => {
    for (const phase of ['lobby', 'reveal', 'score', 'podium'] as const) {
      expect(durationFor(phase, timed)).toBeNull()
      expect(durationFor(phase, paced)).toBeNull()
    }
  })
})
