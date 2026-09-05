import { describe, expect, it } from 'vitest'
import {
  idleLabel,
  markFor,
  memeFilename,
  messageFor,
  progressLabel,
  readyLabel,
  standingsFilename,
} from './labels'

describe('the export key’s label', () => {
  it('is decided by what the device can do, not what it is', () => {
    const sheet = { canShareFiles: true, canWriteImage: true }
    const laptop = { canShareFiles: false, canWriteImage: true }
    const bare = { canShareFiles: false, canWriteImage: false }
    expect(idleLabel('gif', sheet)).toBe('Share GIF')
    expect(idleLabel('gif', laptop)).toBe('Save GIF')
    expect(idleLabel('gif', bare)).toBe('Save GIF')
    expect(idleLabel('png', sheet)).toBe('Share image')
    expect(idleLabel('png', laptop)).toBe('Copy image')
    expect(idleLabel('png', bare)).toBe('Save image')
  })

  it('counts frames while it renders, and does not count one', () => {
    expect(progressLabel(12, 60)).toBe('Rendering 12 of 60…')
    expect(progressLabel(0, 1)).toBe('Rendering…')
  })

  it('asks for a second tap after a stale gesture', () => {
    expect(readyLabel('gif')).toBe('Send GIF')
    expect(readyLabel('png')).toBe('Send image')
  })
})

describe('filenames', () => {
  it('name the round, and the entry when there is one', () => {
    expect(memeFilename(3)).toBe('captionist-round-3.gif')
    expect(memeFilename(3, 2)).toBe('captionist-round-3-entry-2.gif')
    expect(standingsFilename('C-F34213')).toBe('captionist-standings-C-F34213.png')
  })
})

describe('the provider mark', () => {
  it('credits whoever served the picture', () => {
    expect(markFor('https://static.klipy.com/ii/abc/def.gif')).toBe('KLIPY')
    expect(markFor('https://media2.giphy.com/media/abc/giphy.gif')).toBe('Giphy')
  })

  it('credits nobody for the app’s own art', () => {
    expect(markFor('/media/stub-deploy.svg')).toBeUndefined()
    expect(markFor(undefined)).toBeUndefined()
    expect(markFor('')).toBeUndefined()
  })

  it('is not fooled by a lookalike host', () => {
    expect(markFor('https://evil.klipy.com.example/x.gif')).toBeUndefined()
    expect(markFor('https://static.klipy.com.example/x.gif')).toBeUndefined()
  })
})

describe('the snackbar', () => {
  it('says nothing when the sheet was the result, or was dismissed', () => {
    expect(messageFor('gif', 'shared')).toBeUndefined()
    expect(messageFor('png', 'cancelled')).toBeUndefined()
  })

  it('confirms what was invisible', () => {
    expect(messageFor('gif', 'saved')).toBe('GIF saved')
    expect(messageFor('png', 'copied')).toBe('Image copied — paste it into Slack')
    expect(messageFor('gif', 'expired')).toBe('GIF is ready. Tap again to share it.')
  })

  it('says what failed and what to do', () => {
    expect(messageFor('gif', 'failed', 'source')).toBe('Couldn’t fetch that GIF. Try again.')
    expect(messageFor('gif', 'failed', 'render')).toBe('Couldn’t render that GIF. Try again.')
    expect(messageFor('png', 'failed', 'render')).toBe('Couldn’t render the scoreboard. Try again.')
    expect(messageFor('png', 'failed', 'clipboard')).toBe('Couldn’t copy it. Save it instead.')
  })
})
