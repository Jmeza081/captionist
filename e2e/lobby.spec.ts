import { expect, test } from '@playwright/test'

/**
 * The lobby, which is only observable *without* `?bots=`: the autopilot starts
 * the game the instant the room fills, so a bots room has no lobby to look at.
 */
test.describe('the lobby', () => {
  test('shows the room, the roster and a live start button', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')

    // The fixture boots its own room, so the code comes from state — not the URL.
    // `toContainText`: the code is rendered twice, once visibly and once
    // spelled out for screen readers.
    await expect(page.getByTestId('room-code')).toContainText('C-F34213')
    await expect(page.getByRole('listitem')).toHaveCount(5)
    await expect(page.getByText('Jesse')).toBeVisible()

    const start = page.getByRole('button', { name: 'Start game — 5 players ready' })
    await expect(start).toBeVisible()
    await start.click()

    // The opener is a real phase with its own clock, so the room passes
    // through it on the way to the brief.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'opener')
  })

  test('explains the game without leaving the lobby', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')

    // The help key sits beside the mode toggle, so a host can still learn the
    // format — or change it — before the first round starts.
    await page.getByRole('button', { name: 'How Captionist works' }).click()
    await expect(page.getByText('Someone picks the image')).toBeVisible()

    // It is an overlay, never a pause: the room is untouched behind it.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    await page.keyboard.press('Escape')
    await expect(page.getByText('Someone picks the image')).toHaveCount(0)
  })

  test('reads the roster left to right rather than one name per row', async ({ page }) => {
    test.skip(page.viewportSize()!.width < 768, 'single column below the breakpoint')
    await page.goto('/room/DEV?seed=42&phase=lobby')

    const rows = page.getByRole('listitem')
    const first = await rows.nth(0).boundingBox()
    const second = await rows.nth(1).boundingBox()

    // Same row, side by side — a room of twenty should not be a column you
    // have to scroll to count.
    expect(second!.y).toBeCloseTo(first!.y, 0)
    expect(second!.x).toBeGreaterThan(first!.x)
  })

  test('blocks the start without disabling it, and says why out loud', async ({ page }) => {
    // A bare room: just the host, two short of the minimum.
    await page.goto('/room/DEV?seed=42')

    const start = page.getByRole('button', { name: 'Start game — need 2 more' })
    await expect(start).toBeVisible()
    // Blocked is not disabled: it stays clickable and focusable.
    await expect(start).not.toBeDisabled()
    await start.focus()
    await expect(start).toBeFocused()

    await start.click()

    // The whole refusal path in one assertion: the intent goes over the
    // transport, the host authorises it, refuses, and the reason comes back as
    // `authorize`'s own sentence.
    await expect(page.getByRole('status')).toHaveText('Need 2 more players.')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
  })
})
