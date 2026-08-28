import { describe, expect, it } from 'vitest'
import {
  CHAT_HISTORY,
  CHAT_INTERVAL_MS,
  CHAT_MAX_LENGTH,
  createEventStore,
  ROOM_REACTION_INTERVAL_MS,
  tallyKey,
} from './events'
import type { EventStore } from './events'
import type { RoomEvent } from './transport'

/**
 * The event store's guards.
 *
 * Everything here is the receiving side, which is the point: a sender-side
 * throttle binds only a tab that agreed to run it.
 */

const MEMBERS = new Set(['p0', 'p1', 'p2'])

function store(overrides: { self?: string; now?: () => number } = {}): EventStore {
  return createEventStore({
    self: () => overrides.self ?? 'p0',
    isMember: (from) => MEMBERS.has(from),
    now: overrides.now ?? (() => 0),
  })
}

function chat(from: string, text: string, at = 1_000): RoomEvent {
  return { kind: 'chat', from, text, at }
}

function reaction(from: string, targetId: string, emoji: string): RoomEvent {
  return { kind: 'reaction', from, target: 'entry', targetId, emoji, at: 1_000 }
}

function roomReaction(from: string, emoji: string): RoomEvent {
  return { kind: 'reaction', from, target: 'room', targetId: 'room', emoji, at: 1_000 }
}

describe('the chat log', () => {
  it('keeps what a member said', () => {
    const s = store()
    s.receive(chat('p1', 'shipped it on a Friday'))

    const [message] = s.getSnapshot().messages
    expect(message?.text).toBe('shipped it on a Friday')
    expect(message?.from).toBe('p1')
  })

  it('drops anyone who is not in the room', () => {
    const s = store()
    // A sender the roster has never heard of. Under `BroadcastTransport` a
    // guest cannot check a membership token, so this is the guard that holds.
    s.receive(chat('nobody', 'let me in'))
    expect(s.getSnapshot().messages).toHaveLength(0)
  })

  it('drops a second message inside the rate limit, and takes the next one', () => {
    let clock = 0
    const s = store({ now: () => clock })

    s.receive(chat('p1', 'first'))
    clock += CHAT_INTERVAL_MS - 1
    s.receive(chat('p1', 'flooding'))
    expect(s.getSnapshot().messages).toHaveLength(1)

    clock += 2
    s.receive(chat('p1', 'second'))
    expect(s.getSnapshot().messages.map((m) => m.text)).toEqual(['first', 'second'])
  })

  it('rate-limits per sender, not for the room', () => {
    const s = store()
    s.receive(chat('p1', 'one'))
    // Same instant, different person. A shared limit would silence the room
    // every time anybody spoke.
    s.receive(chat('p2', 'two'))
    expect(s.getSnapshot().messages).toHaveLength(2)
  })

  it('ignores the sender’s own timestamp when limiting', () => {
    const clock = 0
    const s = store({ now: () => clock })

    // A hostile tab stamping its messages an interval apart walks straight
    // through any limit that reads `at` instead of arrival.
    s.receive(chat('p1', 'first', 0))
    s.receive(chat('p1', 'second', CHAT_INTERVAL_MS * 10))
    expect(s.getSnapshot().messages).toHaveLength(1)
  })

  it('truncates rather than refuses', () => {
    const s = store()
    s.receive(chat('p1', 'x'.repeat(CHAT_MAX_LENGTH + 50)))

    const [message] = s.getSnapshot().messages
    expect(message?.text).toHaveLength(CHAT_MAX_LENGTH)
  })

  it('drops a message that is only whitespace', () => {
    const s = store()
    s.receive(chat('p1', '   \n  '))
    expect(s.getSnapshot().messages).toHaveLength(0)
  })

  it('keeps only the last of a long session', () => {
    let clock = 0
    const s = store({ now: () => clock })
    for (let i = 0; i < CHAT_HISTORY + 10; i++) {
      clock += CHAT_INTERVAL_MS
      s.receive(chat('p1', `line ${i}`))
    }

    const { messages } = s.getSnapshot()
    expect(messages).toHaveLength(CHAT_HISTORY)
    expect(messages[messages.length - 1]?.text).toBe(`line ${CHAT_HISTORY + 9}`)
  })
})

describe('unread', () => {
  it('counts what other people said, and marks where you stopped', () => {
    let clock = 0
    const s = store({ now: () => clock })

    s.receive(chat('p1', 'first'))
    clock += CHAT_INTERVAL_MS
    s.receive(chat('p2', 'second'))

    const snapshot = s.getSnapshot()
    expect(snapshot.unread).toBe(2)
    expect(snapshot.firstUnreadId).toBe(snapshot.messages[0]?.id)
  })

  it('never counts your own message as unread', () => {
    const s = store({ self: 'p0' })
    s.receive(chat('p0', 'talking to myself'))

    const snapshot = s.getSnapshot()
    expect(snapshot.unread).toBe(0)
    expect(snapshot.firstUnreadId).toBeUndefined()
  })

  it('clears on opening chat', () => {
    const s = store()
    s.receive(chat('p1', 'hello'))
    s.markRead()

    expect(s.getSnapshot().unread).toBe(0)
    expect(s.getSnapshot().firstUnreadId).toBeUndefined()
  })
})

describe('tallies', () => {
  it('counts one reaction per person per emoji', () => {
    const s = store()
    s.receive(reaction('p1', 'e1', '🔥'))
    // The same person, again. Counts only rise, so a repeat has to be a no-op
    // rather than a second point.
    s.receive(reaction('p1', 'e1', '🔥'))
    s.receive(reaction('p2', 'e1', '🔥'))

    expect(s.getSnapshot().tallies[tallyKey('entry', 'e1')]).toEqual([
      { emoji: '🔥', count: 2, mine: false },
    ])
  })

  it('marks the ones you are part of', () => {
    const s = store({ self: 'p0' })
    s.receive(reaction('p1', 'e1', '💀'))
    s.receive(reaction('p0', 'e1', '💀'))

    expect(s.getSnapshot().tallies[tallyKey('entry', 'e1')]).toEqual([
      { emoji: '💀', count: 2, mine: true },
    ])
  })

  it('keeps a card’s array identity when a different card changes', () => {
    const s = store()
    s.receive(reaction('p1', 'e1', '🔥'))
    const before = s.getSnapshot().tallies[tallyKey('entry', 'e1')]

    s.receive(reaction('p1', 'e2', '🔥'))
    // Twenty live cards re-render on every broadcast if this is not true.
    expect(s.getSnapshot().tallies[tallyKey('entry', 'e1')]).toBe(before)
  })

  it('separates a message reaction from an entry reaction with the same id', () => {
    const s = store()
    s.receive(reaction('p1', 'x', '👀'))
    s.receive({ kind: 'reaction', from: 'p2', target: 'message', targetId: 'x', emoji: '👀', at: 0 })

    expect(s.getSnapshot().tallies[tallyKey('entry', 'x')]).toHaveLength(1)
    expect(s.getSnapshot().tallies[tallyKey('message', 'x')]).toHaveLength(1)
  })

  it('fires a fresh burst for every reaction, repeats included', () => {
    const s = store()
    s.receive(reaction('p1', 'e1', '🔥'))
    const first = s.getSnapshot().lastReaction

    s.receive(reaction('p2', 'e1', '🔥'))
    const second = s.getSnapshot().lastReaction

    expect(first?.emoji).toBe('🔥')
    // Same emoji, so only the key can tell the animation to fire again.
    expect(second?.key).toBeGreaterThan(first?.key ?? 0)
  })

  it('ignores a reaction from outside the room', () => {
    const s = store()
    s.receive(reaction('nobody', 'e1', '🔥'))
    expect(s.getSnapshot().tallies[tallyKey('entry', 'e1')]).toBeUndefined()
  })
})

describe('the snapshot', () => {
  it('is referentially stable when nothing changed', () => {
    const s = store()
    const before = s.getSnapshot()
    // React 19 re-reads this during render and loops forever if it allocates.
    expect(s.getSnapshot()).toBe(before)

    s.markRead()
    expect(s.getSnapshot()).toBe(before)
  })
})

/**
 * What a message may carry besides words.
 *
 * The event lane hands sender-supplied image URLs to every member's browser, so
 * these guards are not about rendering — they are about one player deciding
 * what twenty other machines fetch.
 */
describe('attachments and quotes', () => {
  const GIF = { src: 'https://media3.giphy.com/media/abc/200w.gif', alt: 'A cat' }

  it('keeps a GIF sent on its own, with no words at all', () => {
    const s = store()
    s.receive({ kind: 'chat', from: 'p1', text: '', at: 1_000, attachment: GIF })

    const [message] = s.getSnapshot().messages
    expect(message?.attachment).toEqual(GIF)
    expect(message?.text).toBe('')
  })

  it('drops a message that is neither words nor a GIF', () => {
    const s = store()
    // A quote alone is context for something unsaid, not a message.
    s.receive({
      kind: 'chat',
      from: 'p1',
      text: '   ',
      at: 1_000,
      replyTo: { caption: 'Nuff said' },
    })
    expect(s.getSnapshot().messages).toHaveLength(0)
  })

  it('drops the picture and keeps the words when the source is not ours', () => {
    const s = store()
    s.receive({
      kind: 'chat',
      from: 'p1',
      text: 'look at this',
      at: 1_000,
      attachment: { src: 'https://tracker.example/beacon.gif', alt: 'x' },
    })

    const [message] = s.getSnapshot().messages
    expect(message?.text).toBe('look at this')
    expect(message?.attachment).toBeUndefined()
  })

  it('refuses the schemes that are not an image on someone else’s screen', () => {
    for (const src of ['data:image/gif;base64,AAAA', 'javascript:alert(1)', 'blob:x']) {
      const s = store()
      s.receive({ kind: 'chat', from: 'p1', text: '', at: 1_000, attachment: { src, alt: 'x' } })
      // Nothing left once the attachment goes, so the whole message goes.
      expect(s.getSnapshot().messages).toHaveLength(0)
    }
  })

  it('gives a blank alt the fallback rather than an empty accessible name', () => {
    const s = store()
    s.receive({
      kind: 'chat',
      from: 'p1',
      text: '',
      at: 1_000,
      attachment: { src: GIF.src, alt: '   ' },
    })
    expect(s.getSnapshot().messages[0]?.attachment?.alt).toBe('A GIF')
  })

  it('quotes a caption, dropping only the thumbnail if that is the bad part', () => {
    const s = store()
    s.receive({
      kind: 'chat',
      from: 'p1',
      text: 'this one',
      at: 1_000,
      replyTo: { src: 'http://evil.example/x.gif', caption: 'It compiles. Ship it.' },
    })

    const quote = s.getSnapshot().messages[0]?.replyTo
    expect(quote?.caption).toBe('It compiles. Ship it.')
    expect(quote?.src).toBeUndefined()
  })

  it('bounds a quoted caption rather than refusing it', () => {
    const s = store()
    s.receive({
      kind: 'chat',
      from: 'p1',
      text: 'hm',
      at: 1_000,
      replyTo: { caption: 'x'.repeat(500) },
    })
    expect(s.getSnapshot().messages[0]?.replyTo?.caption).toHaveLength(60)
  })

  it('gives a GIF no budget of its own', () => {
    let clock = 0
    const s = store({ now: () => clock })
    s.receive({ kind: 'chat', from: 'p1', text: '', at: 1_000, attachment: GIF })
    clock = CHAT_INTERVAL_MS - 1
    // A media lane with its own allowance would double the flood rate.
    s.receive({ kind: 'chat', from: 'p1', text: '', at: 1_001, attachment: GIF })
    expect(s.getSnapshot().messages).toHaveLength(1)
  })
})

describe('the reaction glyph', () => {
  it('tallies an emoji, and the app’s own tiles', () => {
    const s = store()
    s.receive(reaction('p1', 'r1-e1', '🔥'))
    s.receive(reaction('p1', 'r1-e1', '/media/stub-deploy.svg'))
    expect(s.getSnapshot().tallies[tallyKey('entry', 'r1-e1')]).toHaveLength(2)
  })

  it('refuses a glyph that points somewhere we do not serve', () => {
    // Without this, one player picking a reaction makes the whole room fetch a
    // URL of their choosing — a beacon that needs no script to work.
    const s = store()
    s.receive(reaction('p1', 'r1-e1', 'https://tracker.example/pixel.gif'))
    s.receive(reaction('p1', 'r1-e1', 'data:image/gif;base64,AAAA'))
    s.receive(reaction('p1', 'r1-e1', '/etc/passwd'))
    expect(s.getSnapshot().tallies[tallyKey('entry', 'r1-e1')]).toBeUndefined()
  })

  it('refuses a glyph long enough to be a payload', () => {
    const s = store()
    s.receive(reaction('p1', 'r1-e1', 'x'.repeat(600)))
    expect(s.getSnapshot().tallies[tallyKey('entry', 'r1-e1')]).toBeUndefined()
  })
})


/**
 * Reacting to the room.
 *
 * DESIGNSYSTEM.md's "REACT TO THE ROOM" — the rail's picker, and where the
 * composer's keys land when there is no message to aim at. The design's own
 * prototype fires floaters for it and stores nothing, so this is the one target
 * that leaves no trace behind the burst.
 */
describe('a room reaction', () => {
  it('bursts without leaving a count anywhere', () => {
    const s = store()
    s.receive(roomReaction('p1', '🔥'))

    expect(s.getSnapshot().lastReaction?.emoji).toBe('🔥')
    // Not under `room:room`, and not under anything else either.
    expect(s.getSnapshot().tallies).toEqual({})
  })

  it('can be sent again, unlike a reaction that counts', () => {
    // The dedupe on the other targets exists because a count may only rise
    // once per person. With no count there is nothing to protect, and sending
    // the same thing twice is the entire point of an ambient burst.
    let clock = 0
    const s = store({ now: () => clock })

    s.receive(roomReaction('p1', '🎯'))
    const first = s.getSnapshot().lastReaction?.key

    clock += ROOM_REACTION_INTERVAL_MS
    s.receive(roomReaction('p1', '🎯'))

    expect(s.getSnapshot().lastReaction?.key).not.toBe(first)
  })

  it('is throttled on the local clock, since it has no dedupe to hide behind', () => {
    let clock = 0
    const s = store({ now: () => clock })

    s.receive(roomReaction('p1', '💀'))
    const settled = s.getSnapshot().lastReaction?.key

    // A flooding tab stamps whatever `at` it likes, so the guard reads ours.
    clock += ROOM_REACTION_INTERVAL_MS - 1
    s.receive(roomReaction('p1', '💀'))
    expect(s.getSnapshot().lastReaction?.key).toBe(settled)

    // Somebody else is not the flooder, and is not made to wait for them.
    s.receive(roomReaction('p2', '💀'))
    expect(s.getSnapshot().lastReaction?.key).not.toBe(settled)
  })

  it('checks the glyph against the same allowlist as every other target', () => {
    const s = store()
    s.receive(roomReaction('p1', 'https://evil.example/beacon.gif'))

    expect(s.getSnapshot().lastReaction).toBeUndefined()
  })

  it('still refuses somebody who is not in the room', () => {
    const s = store()
    s.receive(roomReaction('nobody', '🔥'))

    expect(s.getSnapshot().lastReaction).toBeUndefined()
  })
})
