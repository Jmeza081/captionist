import { expect, test } from '@playwright/test'

/**
 * Your entry is in; the room is not.
 *
 * `?as=p2` again: round one's role holder is `p0`, and the role holder sits
 * the round out — so the host never has an entry of their own to show here.
 */
test.describe('waiting', () => {
  test('confirms the entry and names who the room is still on', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=waiting&as=p2&gifs=stub')

    await expect(page.getByText('Nice one. Now we wait.')).toBeVisible()
    await expect(page.getByText('Locked in')).toBeVisible()
    await expect(page.getByText('4 of 4 have submitted')).toBeVisible()
  })

  test('does not offer an edit it cannot honour', async ({ page }) => {
    // Phase is room-wide, so a guest cannot rewind the room to `compose`. The
    // design's "Edit my caption" is deliberately absent, and the body must not
    // promise one either.
    await page.goto('/room/DEV?seed=42&phase=waiting&as=p2&gifs=stub')

    await expect(page.getByRole('button', { name: /edit my caption/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /swap my gif/i })).toHaveCount(0)
    await expect(page.locator('main[data-phase]')).not.toContainText(/you can still edit/i)
  })

  test('gives the host the early exit and nobody else', async ({ page }) => {
    const start = /Everyone’s in — start voting/

    await page.goto('/room/DEV?seed=42&phase=waiting&gifs=stub')
    await expect(page.getByRole('button', { name: start })).toBeVisible()

    // Ending the wait is the same code path the 12s clock takes.
    await page.getByRole('button', { name: start }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote')

    await page.goto('/room/DEV?seed=42&phase=waiting&as=p2&gifs=stub')
    await expect(page.getByRole('button', { name: start })).toHaveCount(0)
  })

  test('locks the answer rather than the caption in the reversed mode', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=waiting&mode=react&as=p2&gifs=stub')

    await expect(page.getByText('Bold choice. Now we wait.')).toBeVisible()
  })
})
