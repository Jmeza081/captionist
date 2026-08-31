import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { MAX_PLAYERS } from '@/lib/game/constants'

/**
 * Dropping out, and coming back.
 *
 * Everything here was modelled before phase 5 and read by nothing:
 * `SEAT_GRACE_MS`, `seatHeldUntil`, `Player.connection` and its `'gone'`
 * variant, `player/reconnected`. These are the tests that make the difference
 * between a held seat and a held seat somebody notices.
 */

const CODE = 'C-F34783'

async function join(context: BrowserContext, name: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/join/${CODE}`)
  await page.getByRole('textbox', { name: 'Nickname' }).fill(name)
  await page.getByRole('button', { name: 'Join the room' }).click()
  await expect(page.locator('main[data-phase]')).toBeVisible()
  return page
}

async function openRoom(context: BrowserContext): Promise<Page> {
  const host = await context.newPage()
  await host.goto(`/room/${CODE}`)
  await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
  return host
}

test.describe('dropping out', () => {
  test('holds the seat but stops counting the person', async ({ context, page }) => {
    test.skip(page.viewportSize()!.width < 768, 'the presence pill lives in the docked rail')
    test.setTimeout(60_000)

    const host = await openRoom(context)
    const guest = await join(context, 'Vic')

    // The rail arrives docked open above `md`, which is the only place this
    // test runs — so there may be no key to press.
    const openKey = host.getByRole('button', { name: /Open chat/ })
    if (await openKey.count()) await openKey.click()
    await expect(host.getByText('2 here')).toBeVisible()

    await guest.close()

    // The seat stays — a drop mid-round must not destroy a submission or
    // renumber the role rotation — so the roster still reads two.
    await expect(host.getByText('1 here')).toBeVisible({ timeout: 20_000 })
    await expect(host.getByText(`2 of ${MAX_PLAYERS}`)).toBeVisible()
  })

  test('tells the player their room is gone, over the room they were in', async ({
    context,
  }) => {
    test.setTimeout(60_000)
    const host = await openRoom(context)
    const guest = await join(context, 'Vic')

    // Losing the host is how a guest drops: there is nobody left to hear it.
    await host.close()

    // The old copy sat behind `if (!state)`, so it only ever appeared for
    // someone who never connected. This one has to arrive over a live room.
    await expect(guest.getByRole('alertdialog')).toBeVisible({ timeout: 20_000 })
    await expect(guest.getByText('Connection dropped.')).toBeVisible()
    // Losing the *host* means nobody is holding a seat, so the copy does not
    // promise one — and no countdown runs against a clock nobody is keeping.
    // The held-seat wording is for a player whose own connection dropped while
    // the room carried on, which needs a real network to reach.
    await expect(guest.getByText(/Nothing is lost/)).toBeVisible()
    await expect(guest.getByText(/until you’re dropped/)).toHaveCount(0)
    await expect(guest.getByRole('button', { name: 'Rejoin now' })).toBeVisible()
    await expect(guest.getByRole('button', { name: 'Leave the game instead' })).toBeVisible()

    // The room is still behind it rather than unmounted — the last state the
    // client saw is what makes the blur worth having.
    await expect(guest.locator('main[data-phase]')).toBeVisible()
  })

  test('does not claim a retry count it cannot know', async ({ context }) => {
    test.setTimeout(60_000)
    const host = await openRoom(context)
    const guest = await join(context, 'Vic')
    await host.close()

    await expect(guest.getByText('Reconnecting…')).toBeVisible({ timeout: 20_000 })
    // The design writes "attempt 3". The transport retries internally and
    // reports no count, so a number here would be one this screen invented.
    await expect(guest.getByText(/attempt \d/)).toHaveCount(0)
  })
})
