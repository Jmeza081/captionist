import { expect, test, type Locator, type Page } from '@playwright/test'
import { CHAT_INTERVAL_MS } from '../lib/room/events'

/**
 * The reaction affordance, everywhere the room puts it.
 *
 * DESIGNSYSTEM.md §4.4 names five sites and rule 4 says the icon is uniform
 * across all of them, which is still true — but *what each one does* was not.
 * The collapsed chat rail carried the room's reaction key, so shouting at the
 * room looked like a chat feature; the composer's emoji fired a burst and left
 * nothing in the log; and the picker, once open, could only be closed by the
 * control that opened it.
 *
 * So: the room's reactions live in the room toolbox, which everybody has now.
 * The composer's emoji post. And the picker closes when you click away from it.
 *
 * Scoped by container throughout, because the same CTA carries the same name in
 * three places — which is the point of rule 4 and the reason a bare
 * `getByRole('button', { name: 'Add a reaction' })` is ambiguous here.
 */

const ROOM = '/room/DEV?seed=42&phase=vote&as=p2&gifs=stub'

const collapsedRail = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Room chat, collapsed' })

const openRail = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Room chat', exact: true })

const toolbox = (page: Page): Locator =>
  page.getByRole('region', { name: /^(Host|Guest) toolbox$/ })

async function enterRoom(page: Page): Promise<void> {
  await page.goto(ROOM)
  await expect(page.getByRole('heading', { name: 'Rank your top three.' })).toBeVisible()
}

async function openToolbox(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /^(Host|Guest) toolbox$/ }).click()
  const panel = toolbox(page)
  await expect(panel).toBeVisible()
  return panel
}

async function openChat(page: Page): Promise<void> {
  // Above `md` the rail arrives docked open — the room greets you with chat
  // rather than with a key to press — so there may be nothing to click.
  //
  // `count()` does not retry, so the room has to have settled into one shape or
  // the other before it is asked: on a phone this raced the first paint and
  // read zero keys on a rail that was about to draw one.
  const composer = page.getByRole('textbox', { name: 'Message the room' })
  const key = page.getByRole('button', { name: /^Open chat/ })
  await expect(composer.or(key).first()).toBeVisible()
  if (await key.count()) await key.click()
  await expect(composer).toBeVisible()
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
  test('is a toolbox tool, not a chat one', async ({ page }) => {
    await enterRoom(page)

    // `as=p2` is a guest, and a guest has a toolbox now — the room's reactions
    // are everybody's, and they used to be reachable only through chat's edge.
    await expect(page.getByRole('button', { name: 'Guest toolbox' })).toBeVisible()
    await expect(
      collapsedRail(page).getByRole('button', { name: 'Add a reaction' }),
    ).toHaveCount(0)
  })

  test('fires from the toolbox and leaves no count behind', async ({ page }) => {
    await enterRoom(page)
    const panel = await openToolbox(page)

    await panel.getByRole('button', { name: 'React with Fire' }).click()

    // A room reaction is the burst and nothing else — the design's prototype
    // fires floaters for it and stores nothing, so no tally may appear.
    await expect(page.getByText(/Fire, \d+ reaction/)).toHaveCount(0)
    // And it does not shut the bar you are reacting from: reacting twice is
    // the whole point.
    await expect(panel).toBeVisible()
  })

  test('reaches the long tail through the picker', async ({ page }) => {
    await enterRoom(page)
    const panel = await openToolbox(page)

    await panel.getByRole('button', { name: 'Add a reaction' }).click()
    const picker = panel.getByRole('dialog', { name: 'React to the room' })
    await expect(picker).toBeVisible()

    await picker.getByRole('button', { name: 'Fire', exact: true }).click()
    await expect(picker).toBeHidden()
    await expect(page.getByText(/Fire, \d+ reaction/)).toHaveCount(0)
  })
})

test.describe('dismissing the picker', () => {
  test('closes on a click outside it', async ({ page }) => {
    await enterRoom(page)
    const panel = await openToolbox(page)

    await panel.getByRole('button', { name: 'Add a reaction' }).click()
    const picker = panel.getByRole('dialog', { name: 'React to the room' })
    await expect(picker).toBeVisible()

    // The bug this covers: the picker opened and then trapped you, because the
    // only thing that could close it was the CTA it hung off.
    await page.getByRole('heading', { name: 'Rank your top three.' }).click()
    await expect(picker).toBeHidden()
  })

  test('the toolbox itself closes on a click outside it', async ({ page }) => {
    await enterRoom(page)
    const panel = await openToolbox(page)

    // Same trap the picker had: a floating bar whose only exit is its own close
    // key. Clicking the room puts it away.
    await page.getByRole('heading', { name: 'Rank your top three.' }).click()
    await expect(panel).toBeHidden()
    await expect(page.getByRole('button', { name: 'Guest toolbox' })).toBeVisible()
  })

  test('Escape closes the picker first, and the toolbox second', async ({ page }) => {
    await enterRoom(page)
    const panel = await openToolbox(page)

    await panel.getByRole('button', { name: 'Add a reaction' }).click()
    const picker = panel.getByRole('dialog', { name: 'React to the room' })
    await expect(picker).toBeVisible()

    // One Escape should not collapse the whole bar out from under a picker you
    // opened inside it.
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    await expect(panel).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
  })

  test('closes on Escape', async ({ page }) => {
    await enterRoom(page)
    const panel = await openToolbox(page)

    await panel.getByRole('button', { name: 'Add a reaction' }).click()
    const picker = panel.getByRole('dialog', { name: 'React to the room' })
    await expect(picker).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
  })
})

test.describe('reacting in chat', () => {
  test('offers the affordance before anyone has said anything', async ({ page }) => {
    await enterRoom(page)
    await openChat(page)

    const rail = openRail(page)
    await expect(rail.getByRole('button', { name: 'Add a reaction' })).toBeVisible()
    await expect(rail.getByRole('button', { name: /^React with / })).toHaveCount(6)

    await rail.getByRole('button', { name: 'Add a reaction' }).click()
    // Not "React to the room" any more. The composer's picker sends a message.
    await expect(page.getByRole('dialog', { name: 'Send an emoji' })).toBeVisible()
  })

  test('a composer emoji posts, rather than vanishing into a burst', async ({ page }) => {
    await enterRoom(page)
    await openChat(page)

    const rail = openRail(page)
    await rail.getByRole('button', { name: 'React with Fire' }).click()

    // It used to fire a room reaction and leave nothing behind, which read as a
    // chat control quietly doing something else.
    await expect(page.getByRole('article').filter({ hasText: '🔥' })).toHaveCount(1)
  })

  test('a picture reaction posts as a picture, not as its path', async ({ page }) => {
    await enterRoom(page)
    await openChat(page)

    const rail = openRail(page)
    await rail.getByRole('button', { name: 'Add a reaction' }).click()
    const picker = page.getByRole('dialog', { name: 'Send an emoji' })
    await picker.getByRole('button', { name: 'LGTM', exact: true }).click()

    // An image tile's glyph is a URL, and `say`'s text lands in the body
    // verbatim — so this used to render `/media/slackmoji-lgtm.svg` as 14px
    // type. It is an attachment now.
    const log = page.getByRole('log', { name: 'Room chat' })
    await expect(log.getByRole('img', { name: 'LGTM' })).toBeVisible()
    await expect(page.getByText('/media/slackmoji-')).toHaveCount(0)
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
