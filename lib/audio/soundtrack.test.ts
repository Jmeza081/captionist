import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RoomPhase } from '@/lib/game/types'
import { CUES, type CueId } from './catalog'
import { bedFor, bedOffset, sameMusic, stingFor, ticks } from './soundtrack'

const PHASES: RoomPhase[] = [
  'lobby',
  'opener',
  'brief',
  'compose',
  'waiting',
  'vote',
  'tiebreak',
  'reveal',
  'score',
  'podium',
]

describe('the catalogue', () => {
  it('ships every file it names', () => {
    for (const [id, cue] of Object.entries(CUES)) {
      expect(existsSync(join(process.cwd(), 'public', cue.src)), id).toBe(true)
    }
  })

  it('credits every cue', () => {
    for (const [id, cue] of Object.entries(CUES)) {
      expect(cue.title, id).toBeTruthy()
      expect(cue.artist, id).toBeTruthy()
      expect(cue.source, id).toMatch(/^https:\/\//)
    }
  })
})

describe('the bed under each phase', () => {
  it('answers for every phase', () => {
    for (const phase of PHASES) {
      expect(() => bedFor({ phase, urgent: false })).not.toThrow()
    }
  })

  it('only ever beds a cue that loops', () => {
    for (const phase of PHASES) {
      for (const urgent of [false, true]) {
        const bed = bedFor({ phase, urgent })
        if (bed) expect(CUES[bed.cue].loop, `${phase}${urgent ? ' urgent' : ''}`).toBe(true)
      }
    }
  })

  it('carries the lobby into the round opener without a restart', () => {
    expect(sameMusic(bedFor({ phase: 'lobby', urgent: false }), bedFor({ phase: 'opener', urgent: false }))).toBe(true)
  })

  it('carries the vote into the reveal, so the sting lands on music', () => {
    expect(sameMusic(bedFor({ phase: 'vote', urgent: false }), bedFor({ phase: 'reveal', urgent: false }))).toBe(true)
  })

  it('changes music for the last stretch of writing, and only writing', () => {
    expect(bedFor({ phase: 'compose', urgent: true })?.cue).toBe('bossFight')
    expect(bedFor({ phase: 'compose', urgent: false })?.cue).toBe('stageSelect')
    expect(bedFor({ phase: 'vote', urgent: true })).toEqual(bedFor({ phase: 'vote', urgent: false }))
  })

  it('goes quiet while the room waits', () => {
    expect(bedFor({ phase: 'waiting', urgent: false })).toBeNull()
  })

  it('opens the podium with the fanfare', () => {
    expect(bedFor({ phase: 'podium', urgent: false })).toMatchObject({ cue: 'ending', intro: 'fanfare' })
  })
})

describe('stings', () => {
  it('fire on the way into the opener and the reveal', () => {
    expect(stingFor('lobby', 'opener')).toBe<CueId>('opener')
    expect(stingFor('vote', 'reveal')).toBe<CueId>('reveal')
    expect(stingFor('tiebreak', 'reveal')).toBe<CueId>('reveal')
  })

  it('never fire on the first phase a tab sees', () => {
    expect(stingFor(undefined, 'reveal')).toBeUndefined()
  })

  it('never fire for a phase that did not change', () => {
    expect(stingFor('reveal', 'reveal')).toBeUndefined()
  })
})

describe('the countdown tick', () => {
  it('ticks the last five seconds of writing', () => {
    expect(ticks('compose', true, 5)).toBe(true)
    expect(ticks('compose', true, 1)).toBe(true)
    expect(ticks('compose', true, 6)).toBe(false)
    expect(ticks('compose', true, 0)).toBe(false)
  })

  it('stays quiet on a paused clock and in every other phase', () => {
    expect(ticks('compose', false, 3)).toBe(false)
    expect(ticks('vote', true, 3)).toBe(false)
  })
})

describe('where a bed starts', () => {
  it('is how long the phase has been running, so every tab plays the same bar', () => {
    const clock = { status: 'running' as const, endsAt: 100_000, totalMs: 60_000 }
    expect(bedOffset(clock, 52_500)).toBe(12.5)
  })

  it('is the top of the track without a running clock', () => {
    expect(bedOffset(undefined, 5_000)).toBe(0)
    expect(bedOffset({ status: 'idle' }, 5_000)).toBe(0)
    expect(bedOffset({ status: 'paused', remainingMs: 1_000, totalMs: 60_000 }, 5_000)).toBe(0)
  })

  it('never starts before the top', () => {
    const clock = { status: 'running' as const, endsAt: 100_000, totalMs: 60_000 }
    expect(bedOffset(clock, 30_000)).toBe(0)
  })
})
