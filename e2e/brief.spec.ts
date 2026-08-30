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

  test('lets you type a search, and keeps both controls beside the field', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')

    // The field was controlled by the hook with a no-op change handler, so it
    // took a suggestion chip but not a keystroke. Typed, not filled: `fill`
    // sets the value in one event and would have passed against the bug.
    const search = page.getByRole('textbox', { name: 'Search Giphy' })
    await search.pressSequentially('rollback')
    await expect(search).toHaveValue('rollback')

    // Both live with the search now — nothing waits at the bottom of a board
    // that scrolls a long way.
    await expect(page.getByRole('button', { name: 'Shuffle results' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Pick one first' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Surprise me' })).toHaveCount(0)

    // And the note about the clock reads with the headline, not with the button.
    await expect(
      page.getByText('If the clock runs out we’ll pick for you'),
    ).toBeInViewport()
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

  test('still puts an image up when the clock wins', async ({ page }) => {
    // `?as=p2` watches from another seat, so nothing in this tab can pick and
    // the brief clock is what ends the phase. It used to hand the room a
    // subject with no image at all and spoil everyone else's round.
    await page.goto('/room/DEV?seed=42&phase=brief&fast=40&as=p2&gifs=stub')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose', {
      timeout: 20_000,
    })

    // A real image off the offline shelf, drawn with the room's own seed.
    const image = page.locator('main[data-phase] figure img').first()
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('src', /\/media\/stub-/)
    await expect(page.getByText('No image was picked in time')).toHaveCount(0)
  })
})
