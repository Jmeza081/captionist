import { expect, test } from '@playwright/test'

/**
 * Answering the round.
 *
 * `?as=p2` is doing real work here: round one's role holder is `p0`, and the
 * role holder sits the round out — so as the host you only ever see the watch
 * face, and the two caption fields are unreachable without taking another seat.
 */
test.describe('composing', () => {
  test('captions the image, and the preview shows what the room will see', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')

    await expect(page.getByText('Make it hurt. Make it funny.')).toBeVisible()
    await expect(page.getByText('0 of 4 have submitted')).toBeVisible()

    // Blocked until there is something to submit.
    await expect(page.getByRole('button', { name: 'Write something first' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Top text' }).fill('Prod’s down again')
    await expect(page.getByText('17 / 60')).toBeVisible()

    // The preview is the same card the vote grid will render, so the overlay
    // has to track the field as it is typed.
    await expect(page.locator('figure').getByText('Prod’s down again')).toBeVisible()

    await page.getByRole('button', { name: 'Submit caption' }).click()
    await expect(page.getByRole('status')).toHaveText('Caption submitted')
    await expect(page.getByText('1 of 4 have submitted')).toBeVisible()
  })

  test('replaces an entry rather than adding a second one', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')

    await page.getByRole('textbox', { name: 'Top text' }).fill('First thought')
    await page.getByRole('button', { name: 'Submit caption' }).click()
    await expect(page.getByText('1 of 4 have submitted')).toBeVisible()

    // "You can swap it until the clock runs out" needs no second action: the
    // reducer upserts on author.
    await page.getByRole('textbox', { name: 'Top text' }).fill('Better thought')
    await page.getByRole('button', { name: 'Submit caption' }).click()
    await expect(page.getByRole('status')).toHaveText('Caption updated')
    await expect(page.getByText('1 of 4 have submitted')).toBeVisible()
  })

  test('lets a blank player skip without holding up the room', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')

    await page.getByRole('button', { name: 'Skip this round' }).click()
    // Skipping still submits — an absent entry would stall everyone on a clock
    // nobody needs.
    await expect(page.getByText('1 of 4 have submitted')).toBeVisible()
  })

  test('answers a prompt with a GIF in the reversed mode', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&mode=react&as=p2&gifs=stub')

    await expect(page.getByText('Answer it with a GIF.')).toBeVisible()
    // The prompt is pinned, so the answer is always judged against it.
    await expect(page.getByText('Jesse’s prompt')).toBeVisible()

    await page.locator('button:has(img)').first().click()
    await expect(page.getByText('Your answer', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Lock in my answer' }).click()
    await expect(page.getByRole('status')).toHaveText('Answer locked in')
  })

  test('gives the role holder the round off', async ({ page }) => {
    // `p0` set this round up, so they watch it rather than competing.
    await page.goto('/room/DEV?seed=42&phase=compose&gifs=stub')

    await expect(page.getByText('They’re captioning your pick.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Top text' })).toHaveCount(0)
  })
})
