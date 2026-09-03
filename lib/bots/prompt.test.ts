import { describe, expect, it } from 'vitest'
import { systemPrompt, userPrompt, type TurnRequest } from './prompt'

const BOTS = [
  { id: 'bot-1', difficulty: 'intern' as const },
  { id: 'bot-2', difficulty: 'principal' as const },
]

describe('what a bot is told', () => {
  it('gives each bot a distinct brief in one prompt', () => {
    // The whole reason a call is batched rather than repeated: N independent
    // calls cannot see what the others wrote and converge on the same joke.
    const prompt = systemPrompt(BOTS)
    expect(prompt).toContain('bot-1')
    expect(prompt).toContain('bot-2')
    expect(prompt).toContain('distinctly different')
  })

  it('carries the house rule about roasting the situation, not a person', () => {
    expect(systemPrompt(BOTS)).toContain('never a person')
  })

  it('asks for two lines only when the room asked for two', () => {
    const base: TurnRequest = { kind: 'answers', mode: 'caption', roundNumber: 1, bots: BOTS }
    expect(userPrompt({ ...base, format: 'tb' })).toContain('two-line')
    // The bug this replaced: one line was returned whatever the room wanted.
    expect(userPrompt({ ...base, format: 'one' })).toContain('one-line')
  })

  it('hands the model the GIF title and the search that found it', () => {
    const prompt = userPrompt({
      kind: 'answers',
      mode: 'caption',
      format: 'one',
      roundNumber: 1,
      bots: BOTS,
      subject: { kind: 'media', alt: 'This Is Fine Dog', query: 'dumpster fire' },
    })
    expect(prompt).toContain('This Is Fine Dog')
    expect(prompt).toContain('dumpster fire')
  })

  it('asks react mode for a search query, never for prose', () => {
    const prompt = userPrompt({
      kind: 'answers',
      mode: 'react',
      roundNumber: 1,
      bots: BOTS,
      subject: { kind: 'prompt', text: 'Describe the deploy.' },
    })
    expect(prompt).toContain('search query')
    expect(prompt).toContain('Describe the deploy.')
  })

  it('ranks only as many places as the room actually has', () => {
    const prompt = userPrompt({
      kind: 'ballots',
      mode: 'caption',
      roundNumber: 1,
      bots: BOTS,
      voting: 'rank',
      places: 2,
      cards: [{ entryId: 'r1-e1', text: 'Ship it.' }],
    })
    expect(prompt).toContain('Rank the 2')
    expect(prompt).toContain('r1-e1')
  })

  it('says pick one when the room votes once', () => {
    const prompt = userPrompt({
      kind: 'ballots',
      mode: 'caption',
      roundNumber: 1,
      bots: BOTS,
      voting: 'single',
      cards: [{ entryId: 'r1-e1', text: 'Ship it.' }],
    })
    expect(prompt).toContain('single funniest')
  })

  it('never puts a player’s name in front of the model', () => {
    // **Structural, not a rule.** The browser sends seat ids and levels, and
    // the projection the bots read has already stripped authorship — so a
    // joke about a colleague is unavailable rather than discouraged. This
    // test is the tripwire for a future field quietly widening that.
    const everything = [
      systemPrompt(BOTS),
      userPrompt({
        kind: 'ballots',
        mode: 'caption',
        roundNumber: 1,
        bots: BOTS,
        voting: 'rank',
        places: 3,
        cards: [{ entryId: 'r1-e1', text: 'Ship it.' }],
      }),
    ].join('\n')
    for (const name of ['Priya', 'Jorge', 'Eternal_Backlog']) {
      expect(everything).not.toContain(name)
    }
    // Seat ids are fine — they are what the answer is keyed on, and they name
    // nobody.
    expect(everything).toContain('bot-1')
  })
})
