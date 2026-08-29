import { expect, test, type Page } from '@playwright/test'

/**
 * The screen a room opens behind.
 *
 * It replaced a bare paragraph that served host and guest identically, so the
 * two halves of every assertion here are: *which* room is opening, and how far
 * along it is. The pacing floors in `lib/room/bootTimeline.ts` are what make
 * this observable at all — on the tab transport the whole boot resolves in a
 * few hundred milliseconds, and without them there would be nothing to catch.
 */

/**
 * One room per test, so they parallelise. Six characters from the code
 * alphabet, which drops every character that collides when a code is read
 * aloud — a `0` here round-trips through `normalizeCode` as a `Q`, and a `1`
 * as a `J`, so the URL under test stops being the one written down.
 */
const HOSTED = 'C-F34AAA'
const STEPS = 'C-F34BBB'
const CANCEL = 'C-F34CCC'
const FRESH = 'C-F34DDD'

/** The room, once the boot has actually handed over. */
const room = (page: Page) => page.locator('main[data-phase]')

/** A checklist row by its copy, whatever state it is in. */
const step = (page: Page, label: string) => page.getByRole('listitem').filter({ hasText: label })

test.describe('opening a room', () => {
  test('opens a host on their own screen, never the guest’s', async ({ page }) => {
    await page.goto('/host')
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Jesse')
    await page.getByRole('button', { name: 'Open the room' }).click()

    // The claim probe has not resolved yet at this point — the title comes from
    // the pending settings `/host` left behind, which is the whole reason the
    // boot role is seeded from intent rather than from the election's answer.
    await expect(page.getByRole('heading', { name: 'Opening your room' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Joining the room' })).toHaveCount(0)

    // Its rows, and only its rows.
    await expect(step(page, 'Claiming your room code')).toBeVisible()
    await expect(step(page, 'Setting your rules')).toBeVisible()
    await expect(step(page, 'Opening the waiting room')).toBeVisible()
    await expect(step(page, 'Seating you in the lobby')).toHaveCount(0)

    // The code on the pill is the room it actually opens.
    const code = (await page.getByTestId('room-code').first().innerText()).trim()
    await expect(room(page)).toHaveAttribute('data-phase', 'lobby')
    expect(new URL(page.url()).pathname).toBe(`/room/${code.split('\n')[0]?.trim() ?? ''}`)
  })

  test('opens a guest on theirs, and waits until they have a seat', async ({ context }) => {
    // Somebody has to be hosting, or the guest wins the election and becomes
    // the host of an empty room — which is today's behaviour, deliberately.
    const host = await context.newPage()
    await host.goto(`/room/${HOSTED}`)
    await expect(room(host)).toHaveAttribute('data-phase', 'lobby')

    const page = await context.newPage()
    await page.goto(`/join/${HOSTED}`)
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Vic')
    await page.getByRole('button', { name: 'Join the room' }).click()

    await expect(page.getByRole('heading', { name: 'Joining the room' })).toBeVisible()
    await expect(step(page, 'Finding the room')).toBeVisible()
    await expect(step(page, 'Waiting for the host')).toBeVisible()
    await expect(step(page, 'Seating you in the lobby')).toBeVisible()

    // The hand-off waits for the seat, not for the first broadcast. Before this
    // screen existed the lobby drew a roster the viewer was missing from.
    await expect(room(page)).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Vic' })).toBeVisible()
  })

  test('reports each step, and finishes on the last one', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${STEPS}`)
    await expect(room(host)).toHaveAttribute('data-phase', 'lobby')

    const page = await context.newPage()
    await page.goto(`/join/${STEPS}`)
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Roberto')
    await page.getByRole('button', { name: 'Join the room' }).click()

    // The states are announced in words as well as drawn, so a screen reader
    // hears the same progress the rail shows.
    //
    // Which word, deliberately not: every mid-boot state is a transient this
    // test has no way to synchronise on. The floors in `bootTimeline.ts` make
    // the sequence *readable*, not observable on demand — a busy machine can
    // deschedule the runner past the whole 900ms boot between the click and
    // the first poll, and then "In progress" has already become "Done" and the
    // assertion fails on nothing. It asserted the first row for exactly that
    // reason and still raced. The four states are asserted exhaustively in the
    // gallery, where they are props rather than a moment.
    //
    // What is worth asserting here is what only a real boot can show: that all
    // three rows are announced, and that the last word any of them reaches is
    // the one that hands the room over.
    for (const label of ['Finding the room', 'Waiting for the host', 'Seating you in the lobby']) {
      await expect(step(page, label)).toContainText(/Not started|In progress|Done/)
    }

    // And the sequence really does end in the room.
    await expect(step(page, 'Finding the room')).toContainText('Done')
    await expect(room(page)).toBeVisible()
  })

  test('offers a way back out of a boot, per role', async ({ page, context }) => {
    // The guest's door is the one they came in by, code still prefilled.
    const host = await context.newPage()
    await host.goto(`/room/${CANCEL}`)
    await expect(room(host)).toHaveAttribute('data-phase', 'lobby')

    await page.goto(`/join/${CANCEL}`)
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Vic')
    await page.getByRole('button', { name: 'Join the room' }).click()
    await page.getByRole('link', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(new RegExp(`/join/${CANCEL}$`))
  })

  test('does not hand a cancelled host’s rules to the next room', async ({ page }) => {
    await page.goto('/host')
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Jesse')
    // Anything that is not the default, so it is visible if it leaks.
    await page.getByRole('radio', { name: 'React to the caption' }).click()
    await page.getByRole('button', { name: 'Open the room' }).click()

    await expect(page.getByRole('heading', { name: 'Opening your room' })).toBeVisible()
    await page.getByRole('link', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/host$/)

    // A room opened straight from a URL, with no settings of its own. It must
    // come up in the default mode, not the one the cancelled room chose.
    await page.goto(`/room/${FRESH}`)
    await expect(room(page)).toHaveAttribute('data-phase', 'lobby')
    await expect(page.getByRole('radio', { name: 'Caption the image' })).toBeChecked()
  })

  /**
   * The four row states, exhaustively — on the gallery rather than on a live
   * boot, where the last row is done for a single frame before the screen it
   * is on hands over.
   */
  test('draws every step state, and names it in words', async ({ page }) => {
    await page.goto('/components#boot')

    const guest = page
      .getByRole('listitem')
      .filter({ hasText: 'Seating you in the lobby' })
      .first()
    await expect(guest).toContainText('In progress')

    const host = page.getByRole('listitem').filter({ hasText: 'Setting your rules' })
    await expect(host).toContainText('In progress')
    await expect(page.getByRole('listitem').filter({ hasText: 'Opening the waiting room' })).toContainText(
      'Not started',
    )
    await expect(page.getByRole('listitem').filter({ hasText: 'Claiming your room code' })).toContainText(
      'Done',
    )

    // A refusal says what happened, on the screen that is showing, and turns
    // Cancel into the way out.
    await expect(page.getByText('This room is full — 20 players is the limit.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go back' })).toBeVisible()
  })
})
