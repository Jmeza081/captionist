import { expect, test } from '@playwright/test'

/**
 * Your entry is in; the room is not.
 *
 * `?as=p2` again: round one's role holder is `p0`, and the role holder sits
 * the round out — so the host never has an entry of their own to show here.
 *
 * `?out=n` holds n competitors back. Without it every fixture submits
 * everybody, and the half of this screen that still has someone to wait for is
 * unreachable — the room only gets there by the compose clock expiring.
 */
test.describe('waiting', () => {
  test('confirms the entry and names who the room is still on', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=waiting&out=1&as=p2&gifs=stub')

    await expect(page.getByText('Nice one. Now we wait.')).toBeVisible()
    await expect(page.getByText('Locked in')).toBeVisible()
    await expect(page.getByText('3 of 4 have submitted')).toBeVisible()
  })

  test('stops saying "now we wait" once there is nobody to wait for', async ({ page }) => {
    // The last entry landing flips the phase, so this face is the common one:
    // a tracker reading N of N under a headline about waiting was the room
    // announcing a finished fact as if it were pending.
    await page.goto('/room/DEV?seed=42&phase=waiting&as=p2&gifs=stub')

    await expect(page.getByText('That’s everyone in.')).toBeVisible()
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
    // The label names who gets left behind. It used to read "Everyone's in —
    // start voting" unconditionally, directly under a tracker saying they were
    // not.
    const start = /Start voting without Jack/

    await page.goto('/room/DEV?seed=42&phase=waiting&out=1&gifs=stub')
    await expect(page.getByRole('button', { name: start })).toBeVisible()

    // Ending the wait is the same code path the 12s clock takes.
    await page.getByRole('button', { name: start }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote')

    await page.goto('/room/DEV?seed=42&phase=waiting&out=1&as=p2&gifs=stub')
    await expect(page.getByRole('button', { name: start })).toHaveCount(0)
  })

  test('counts the stragglers rather than naming all of them', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=waiting&out=2&gifs=stub')

    await expect(page.getByRole('button', { name: 'Start voting without 2 players' })).toBeVisible()
  })

  test('drops the host button when the wait is already over', async ({ page }) => {
    // Nothing to decide: the room advances on its own in `WAITING_ALL_IN_MS`,
    // so a primary CTA here reads as a gate over a door already closing.
    await page.goto('/room/DEV?seed=42&phase=waiting&gifs=stub')

    await expect(page.getByText('That’s everyone in.')).toBeVisible()
    await expect(page.getByRole('button', { name: /start voting/i })).toHaveCount(0)

    // And it still gets there without anyone touching it.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote', {
      timeout: 8_000,
    })
  })

  test('locks the answer rather than the caption in the reversed mode', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=waiting&out=1&mode=react&as=p2&gifs=stub')

    await expect(page.getByText('Bold choice. Now we wait.')).toBeVisible()
  })
})
