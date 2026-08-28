import { expect, test, type Locator, type Page } from '@playwright/test'
import { CHAT_INTERVAL_MS } from '../lib/room/events'

/**
 * The reaction affordance, everywhere the design puts it.
 *
 * DESIGNSYSTEM.md §4.4 names five sites — caption cards, chat messages, the
 * composer, the collapsed rail and the reveal bar — and rule 4 says the icon is
 * uniform across all of them. Three were missing or half-wired: the rail's
 * picker was declared and never passed its handler, chat reactions always
 * landed on whatever arrived last, and an empty log rendered six quick keys
 * that silently did nothing.
 *
 * Scoped by rail throughout, because a vote card carries the same CTA with the
 * same name — which is the point of rule 4 and the reason a bare
 * `getByRole('button', { name: 'Add a reaction' })` is ambiguous here.
 */

const ROOM = '/room/DEV?seed=42&phase=vote&as=p2&gifs=stub'

const collapsedRail = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Room chat, collapsed' })

const openRail = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Room chat', exact: true })

async function enterRoom(page: Page): Promise<void> {
  await page.goto(ROOM)
  await expect(page.getByRole('heading', { name: 'Rank your top three.' })).toBeVisible()
}

async function openChat(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Open chat/ }).click()
  await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()
}

async function say(page: Page, text: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Message the room' }).fill(text)
  await page.getByRole('button', { name: 'Send message' }).click()
  // `CHAT_INTERVAL_MS` is 1.5s on the *receiving* side, so a second message
  // sent any sooner is dropped and never reaches the log. Without this wait the
  // "not the newest" assertion below passes against a message that isn't there.
  await expect(page.getByRole('article').filter({ hasText: text })).toBeVisible()
}

test.describe('reacting to the room', () => {
  test('opens from the collapsed rail and leaves no count behind', async ({ page }) => {
    await enterRoom(page)

    await collapsedRail(page).getByRole('button', { name: 'Add a reaction' }).click()

    const picker = page.getByRole('dialog', { name: 'React to the room' })
    await expect(picker).toBeVisible()

    await picker.getByRole('button', { name: 'Fire', exact: true }).click()
    await expect(picker).toBeHidden()

    // A room reaction is the burst and nothing else — the design's prototype
    // fires floaters for it and stores nothing, so no tally may appear.
    await expect(page.getByText(/Fire, \d+ reaction/)).toHaveCount(0)
  })
})

test.describe('reacting in chat', () => {
  test('offers the affordance before anyone has said anything', async ({ page }) => {
    await enterRoom(page)
    await openChat(page)

    const rail = openRail(page)
    // Both were wrong here: the CTA was withheld on the grounds that a dead
    // control is worse than none, while the six quick keys beside it were
    // rendered anyway and did nothing at all.
    await expect(rail.getByRole('button', { name: 'Add a reaction' })).toBeVisible()
    await expect(rail.getByRole('button', { name: /^React with / })).toHaveCount(6)

    await rail.getByRole('button', { name: 'Add a reaction' }).click()
    await expect(page.getByRole('dialog', { name: 'React to the room' })).toBeVisible()
  })

  test('lands on the message you aimed at, not the newest', async ({ page }) => {
    await enterRoom(page)
    await openChat(page)

    await say(page, 'first thing')
    await page.waitForTimeout(CHAT_INTERVAL_MS)
    await say(page, 'second thing')

    const first = page.getByRole('article').filter({ hasText: 'first thing' })
    const second = page.getByRole('article').filter({ hasText: 'second thing' })

    // Both actually in the log, or the last assertion proves nothing.
    await expect(first).toHaveCount(1)
    await expect(second).toHaveCount(1)

    // The older message. Until now every chat reaction went to whatever
    // arrived last, so this would have counted against "second thing".
    await first.getByRole('button', { name: /message$/ }).click()

    const picker = page.getByRole('dialog', { name: /^React to / })
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: 'Skull', exact: true }).click()

    await expect(first.getByText('Skull, 1 reaction, including yours')).toBeVisible()
    await expect(second.getByText(/Skull/)).toHaveCount(0)
  })
})
