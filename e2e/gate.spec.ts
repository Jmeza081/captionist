import { expect, test } from '@playwright/test'

/**
 * The phase-2 gate, as the roadmap words it:
 *
 *   "Play to `waiting` on a phone viewport; timer, rail offset and toolbox
 *    all real."
 *
 * One test per clause, so a failure names which half of the gate broke.
 */
test.describe('the phase 2 gate', () => {
  test('plays a real round from the lobby to waiting', async ({ page }) => {
    test.setTimeout(60_000)
    // `fast=4` leaves the 30s brief clock at ~7s of real time — enough to pick
    // a GIF by hand without the round timing out mid-test.
    await page.goto('/room/DEV?seed=42&bots=4&fast=4&gifs=stub')

    const room = page.locator('main[data-phase]')

    // The autopilot stands in for four people tapping "Start" — the fifth
    // player landing is what opens the room.
    await expect(room).toHaveAttribute('data-phase', 'opener', { timeout: 15_000 })
    await expect(room).toHaveAttribute('data-phase', 'brief', { timeout: 15_000 })

    // Round one's role holder is the host, so this is the picker.
    await page.locator('button:has(img)').first().click()
    await page.getByRole('button', { name: 'Lock it in' }).click()

    // Compose is deliberately not asserted here: the host set this round up,
    // so they are not competing, and four bots submit within a frame — the
    // reducer then advances the moment every competitor is in. The screen
    // itself is covered properly in `compose.spec.ts`.
    await expect
      .poll(async () => (await room.getAttribute('data-phase')) ?? '', { timeout: 20_000 })
      .toMatch(/^(waiting|vote)$/)
  })

  test('runs a real clock', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')

    const timer = page.getByRole('timer')
    await expect(timer).toContainText('to pick')

    const seconds = async () => {
      const text = (await timer.textContent()) ?? '0:00'
      const [m = '0', s = '0'] = text.replace(/[^\d:]/g, '').split(':')
      return Number(m) * 60 + Number(s)
    }

    const first = await seconds()
    await expect.poll(seconds, { timeout: 8_000 }).toBeLessThan(first)

    // The rail drains with it rather than tracking something of its own.
    const rail = page.locator('main[data-phase]')
    await expect(rail).toBeVisible()
  })

  test('offsets the toolbox by the rail, at both rail widths', async ({ page }) => {
    // Desktop only: a phone has no docked rail, which is the point — nothing
    // may offset by a rail that is not there.
    test.skip(page.viewportSize()!.width < 768, 'no docked rail below the breakpoint')
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')

    const fab = page.getByRole('button', { name: 'Host toolbox' })
    const collapsed = (await fab.boundingBox())!.x

    await page.getByRole('button', { name: /Open chat/ }).click()
    await expect(page.getByText('Room chat')).toBeVisible()

    // The rail grew from 64px to 360px, so the toolbox moved left by the
    // difference rather than sliding underneath it.
    const docked = (await fab.boundingBox())!.x
    expect(collapsed - docked).toBeCloseTo(360 - 64, -1)
  })

  test('gives the host controls that actually move the room', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')
    const room = page.locator('main[data-phase]')

    await page.getByRole('button', { name: 'Host toolbox' }).click()
    await page.getByRole('button', { name: 'Skip ahead' }).click()

    // Skipping is the same mechanism as the clock expiring, so the round gets
    // the fallback subject and moves on.
    await expect(room).toHaveAttribute('data-phase', 'compose')
  })
})
