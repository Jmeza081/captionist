import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { MAX_PLAYERS } from '@/lib/game/constants'

/**
 * The phase-4 gate, as the roadmap words it:
 *
 *   "Two tabs, one host one guest, a real game with no network."
 *
 * One test per clause, so a failure names which half of the gate broke.
 *
 * Every tab here is a separate `BroadcastChannel` peer in one browser, which is
 * exactly the shape phase 5 replaces with Ably — the join flow above this layer
 * does not change when it does.
 */

/** A guest arrives through `/join`, because that is where it gets a name. */
async function join(context: BrowserContext, code: string, name: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/join/${code}`)
  await page.getByRole('textbox', { name: 'Nickname' }).fill(name)
  await page.getByRole('button', { name: 'Join the room' }).click()
  // A room that has already started seats them straight into the round in
  // progress, so this waits for *a* room rather than for the lobby.
  await expect(page.locator('main[data-phase]')).toBeVisible()
  return page
}

const CODE = 'C-F34783'

test.describe('the phase 4 gate', () => {
  test('seats a guest in the room the host opened', async ({ context }) => {
    const host = await context.newPage()
    await host.goto('/host')
    await host.getByRole('textbox', { name: 'Nickname' }).fill('Jesse')
    await host.getByRole('button', { name: 'Open the room' }).click()
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const code = new URL(host.url()).pathname.split('/').pop() ?? ''
    const guest = await join(context, code, 'Vic')

    // One room, two views of it.
    await expect(host.getByText(`2 of ${MAX_PLAYERS}`)).toBeVisible()
    await expect(host.getByRole('listitem').filter({ hasText: 'Vic' })).toBeVisible()
    await expect(guest.getByRole('listitem').filter({ hasText: 'Jesse' })).toBeVisible()
  })

  test('offers a guest nothing that is the host’s to do', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${CODE}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, CODE, 'Vic')

    // The host invites, sets the rules, and starts. A guest gets none of it —
    // every one of those controls would only ever hand them a refusal.
    await expect(guest.getByRole('button', { name: /Start game/ })).toHaveCount(0)
    await expect(guest.getByRole('radiogroup')).toHaveCount(0)
    await expect(guest.getByText('Scan or type the code')).toHaveCount(0)
    await expect(guest.getByText('Waiting on the host to start')).toBeVisible()

    // Shown instead of offered: the rules the host set, read-only.
    await expect(guest.getByText('Rounds', { exact: true })).toBeVisible()
    await expect(guest.getByText('Rank your top 3')).toBeVisible()

    // And the host still has all of it.
    await expect(host.getByRole('button', { name: /Start game/ })).toBeVisible()
  })

  test('plays a real round across both tabs', async ({ context }) => {
    test.setTimeout(60_000)
    const host = await context.newPage()
    // Real clock: the opener is 3.8s and the brief 30s, which is a wide enough
    // window to catch all three tabs in it. Speeding the room up would only
    // make this a race against the test's own assertions.
    await host.goto(`/room/${CODE}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    // Three is the floor for voting to mean anything.
    const one = await join(context, CODE, 'Vic')
    const two = await join(context, CODE, 'Roberto')
    await expect(host.getByText(`3 of ${MAX_PLAYERS}`)).toBeVisible()

    await host.getByRole('button', { name: /Start game/ }).click()

    // The host pushed the transition, so every tab moves — nobody self-advances,
    // and no tab is running a clock of its own.
    for (const page of [host, one, two]) {
      await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'brief', {
        timeout: 20_000,
      })
    }

    // Round one's role holder is the host, so the guests are watching them pick.
    await expect(one.getByText(/is scrolling Giphy/)).toBeVisible()
    await expect(host.getByText('Pick the GIF everyone has to suffer through.')).toBeVisible()
  })

  test('tells the guest who asked, in the guest’s own tab', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${CODE}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    await join(context, CODE, 'Vic')

    // `uniqueNicknames` is on by default, so a second Vic is refused — and the
    // refusal has to cross a tab boundary to be heard at all. An in-process
    // callback on the host would reach nobody.
    const twin = await context.newPage()
    await twin.goto(`/join/${CODE}`)
    await twin.getByRole('textbox', { name: 'Nickname' }).fill('Vic')
    await twin.getByRole('button', { name: 'Join the room' }).click()

    await expect(twin.getByRole('status')).toHaveText('Someone already has that name. Pick another.')
  })

  test('lets somebody in after the room has started', async ({ context }) => {
    test.setTimeout(60_000)
    const host = await context.newPage()
    await host.goto(`/room/${CODE}?gifs=stub`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    await join(context, CODE, 'Vic')
    await join(context, CODE, 'Roberto')
    await host.getByRole('button', { name: /Start game/ }).click()
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'brief', {
      timeout: 20_000,
    })

    // The lobby has always promised this; the phase guard used to refuse it.
    const late = await join(context, CODE, 'Jack')

    // In the room, and watching: they have no entry in the round in progress,
    // so `competitors()` leaves them out and nobody waits on one.
    await expect(late.locator('main[data-phase]')).toHaveAttribute('data-phase', 'brief')
    await expect(late.getByText(/is scrolling Giphy/)).toBeVisible()
  })
})
