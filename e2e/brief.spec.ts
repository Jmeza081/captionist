import { expect, test } from '@playwright/test'

/**
 * Setting the round up, in all four faces.
 *
 * `?gifs=stub` keeps every run off Giphy's rate limit and makes the grid
 * deterministic. `?as=p2` sits in someone else's seat — round one's role
 * holder is always `p0`, so the waiting faces are unreachable otherwise.
 */
test.describe('the brief', () => {
  test('picks a GIF and opens the round', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')

    await expect(page.getByText('You’re up, Jesse')).toBeVisible()

    // The CTA is blocked until something is chosen, and says so.
    const lock = page.getByRole('button', { name: 'Pick one first' })
    await expect(lock).toBeVisible()

    await page.getByRole('textbox', { name: 'Search Giphy' }).fill('prod')
    await page.getByRole('textbox', { name: 'Search Giphy' }).press('Enter')
    // A GIF tile is the only button on the screen wrapping an image: matching
    // the label would also catch the blocked "Pick one first" CTA, and
    // `aria-pressed` would catch the suggestion chips.
    const tiles = page.locator('button:has(img)')
    await expect(tiles.first()).toBeVisible()

    await tiles.first().click()
    await expect(page.getByText('Selected', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Lock it in' }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose')
  })

  test('writes a prompt in the reversed mode, with a live preview', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&mode=react&gifs=stub')

    await expect(page.getByText('You’re the Prompter')).toBeVisible()

    const field = page.getByRole('textbox', { name: 'The prompt' })
    await field.fill('me explaining the outage to leadership')

    // The design's counter, exactly: 38 of 90.
    await expect(page.getByText('38 / 90')).toBeVisible()
    // What the room sees updates as you type, and it is your prompt, not
    // someone else's, so it is not addressed in the third person.
    await expect(page.getByText('Your prompt', { exact: true })).toBeVisible()
    await expect(page.getByText('“me explaining the outage to leadership”')).toBeVisible()

    await page.getByRole('button', { name: 'Send it to the room' }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose')
  })

  test('turns the wait into something to read', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&as=p2&gifs=stub')

    await expect(page.getByText('Jesse is scrolling Giphy.')).toBeVisible()
    await expect(page.getByText('Picking')).toBeVisible()
    // Not your deadline, so the clock drops its suffix.
    await expect(page.getByRole('timer')).toHaveText(/^\d:\d\d$/)
  })

  test('falls back to an honest empty image when the clock wins', async ({ page }) => {
    // Nobody picks; the brief clock expires and the reducer supplies a subject
    // with no image at all.
    await page.goto('/room/DEV?seed=42&phase=brief&fast=40&as=p2&gifs=stub')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose', {
      timeout: 20_000,
    })

    // An empty `src` would refetch the page; the card states what happened.
    await expect(page.getByText('No image was picked in time')).toBeVisible()
  })
})
