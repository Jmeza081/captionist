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
/** A room of its own, because the suite runs fully parallel. */
const MID_ROUND = 'C-F34784'
const QUIET = 'C-F34785'

async function join(context: BrowserContext, name: string, code = CODE): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/join/${code}`)
  await page.getByRole('textbox', { name: 'Nickname' }).fill(name)
  await page.getByRole('button', { name: 'Join the room' }).click()
  await expect(page.locator('main[data-phase]')).toBeVisible()
  return page
}

async function openRoom(context: BrowserContext, code = CODE): Promise<Page> {
  const host = await context.newPage()
  await host.goto(`/room/${code}`)
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

/**
 * The round itself, not just the roster.
 *
 * The seat was already held and the presence pill already fell, but nothing in
 * the *round* read any of it: `competitorCount` was `players.length - 1`, so a
 * closed tab kept its place in every denominator and the room played out a full
 * clock waiting on a browser that no longer existed. See ADR 0029.
 */
test.describe('a tab that closes mid-round', () => {
  test('raises nothing in the browser on the way out', async ({ context }) => {
    // The reported bug: `close()` left `presence.leave()` rejecting against a
    // connection it had just shut, and nobody caught it.
    const host = await openRoom(context, QUIET)
    const guest = await join(context, 'Vic', QUIET)

    const errors: string[] = []
    guest.on('pageerror', (error) => errors.push(String(error)))
    const rejections: string[] = []
    host.on('pageerror', (error) => rejections.push(String(error)))

    await expect(host.getByText(`2 of ${MAX_PLAYERS}`)).toBeVisible()
    await guest.close()

    // The host outlives the guest, so it is the tab that would report a
    // rejection provoked by the other one leaving.
    await expect(host.locator('main[data-phase]')).toBeVisible()
    expect(errors, errors.join('\n')).toEqual([])
    expect(rejections, rejections.join('\n')).toEqual([])
  })

  test('stops the room waiting on a chair nobody is in', async ({ context }) => {
    test.setTimeout(90_000)
    const host = await openRoom(context, MID_ROUND)
    const one = await join(context, 'Vic', MID_ROUND)
    const two = await join(context, 'Roberto', MID_ROUND)
    await expect(host.getByText(`3 of ${MAX_PLAYERS}`)).toBeVisible()

    await host.getByRole('button', { name: /Start game/ }).click()
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'brief', {
      timeout: 20_000,
    })

    // Round one's role holder is the host, so they set the round up and the two
    // guests are the competitors. A tile is the only button wrapping an image.
    const tiles = host.locator('button:has(img)')
    await expect(tiles.first()).toBeVisible({ timeout: 20_000 })
    await tiles.first().click()
    await host.getByRole('button', { name: 'Lock it in' }).click()
    for (const page of [one, two]) {
      await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose', {
        timeout: 20_000,
      })
    }

    // One of the two writes something; the other closes their tab. Nobody the
    // room can still reach is outstanding, so the wait is over — and before
    // this it would have run the compose clock down to zero.
    await one.getByRole('textbox', { name: 'Top text' }).fill('shipped it on a Friday')
    await one.getByRole('button', { name: 'Submit caption' }).click()
    await two.close()

    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'waiting', {
      timeout: 25_000,
    })
  })
})
