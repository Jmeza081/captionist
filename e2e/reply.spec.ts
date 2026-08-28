import { expect, test } from '@playwright/test'

/**
 * Answering a caption in chat.
 *
 * Its own file because it spans three things none of the others own: the vote
 * grid raises the reply, the shell carries it, and the rail spends it. The
 * design draws the result (Screens 2c) and never the control that starts it,
 * so the affordance itself is ours — which makes the spec the only place its
 * behaviour is written down.
 */

const REPLY = 'C-F34821'
const CLEARS = 'C-F34822'
const OUTLIVES = 'C-F34823'

test.describe('replying to a caption', () => {
  test('opens chat with the caption quoted, and sends it with the message', async ({
    page,
  }) => {
    await page.goto(`/room/${REPLY}?seed=42&phase=vote&as=p2&gifs=stub`)

    // Chat is collapsed by default at both sizes, so staging a reply has to
    // open it — a quote staged behind a shut rail is a dead end.
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeHidden()

    await page.getByRole('button', { name: 'Reply in chat to It compiles. Ship it.' }).click()
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()

    const composer = page.getByText('Replying to').locator('..')
    await expect(composer).toContainText('It compiles. Ship it.')

    await page.getByRole('textbox', { name: 'Message the room' }).fill('bold claim')
    await page.getByRole('button', { name: 'Send message' }).click()

    const log = page.getByRole('log', { name: 'Room chat' })
    await expect(log).toContainText('bold claim')
    await expect(log).toContainText('It compiles. Ship it.')
  })

  test('stops replying without sending, and does not stick to the next message', async ({
    page,
  }) => {
    await page.goto(`/room/${CLEARS}?seed=42&phase=vote&as=p2&gifs=stub`)

    await page.getByRole('button', { name: 'Reply in chat to It compiles. Ship it.' }).click()
    await expect(page.getByText('Replying to')).toBeVisible()

    await page.getByRole('button', { name: 'Stop replying' }).click()
    await expect(page.getByText('Replying to')).toBeHidden()

    // A quote that outlived its message would attach itself to whatever you
    // said next, which is worse than no quote at all.
    await page.getByRole('textbox', { name: 'Message the room' }).fill('unrelated thought')
    await page.getByRole('button', { name: 'Send message' }).click()

    const log = page.getByRole('log', { name: 'Room chat' })
    await expect(log).toContainText('unrelated thought')
    await expect(log).not.toContainText('It compiles. Ship it.')
  })

  test('keeps the quote readable after the round has moved on', async ({ page }) => {
    // The whole reason the event carries a snapshot rather than an `EntryId`.
    // `round.entries` is replaced wholesale when the round turns over, so an id
    // would resolve to nothing here — exactly when the design's reason for the
    // quote ("keeps the reply legible after the grid has scrolled") applies.
    await page.goto(`/room/${OUTLIVES}?seed=42&phase=vote&as=p2&gifs=stub&fast=20`)

    await page.getByRole('button', { name: 'Reply in chat to It compiles. Ship it.' }).click()
    await page.getByRole('textbox', { name: 'Message the room' }).fill('still true')
    await page.getByRole('button', { name: 'Send message' }).click()

    const log = page.getByRole('log', { name: 'Room chat' })
    await expect(log).toContainText('It compiles. Ship it.')

    // Let the room run past this round. The quote is scrollback now, and the
    // entries it named are gone.
    await expect(page.locator('main[data-phase]')).not.toHaveAttribute('data-phase', 'vote', {
      timeout: 20_000,
    })
    await expect(log).toContainText('still true')
    await expect(log).toContainText('It compiles. Ship it.')
  })
})
