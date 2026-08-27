import { expect, test } from '@playwright/test'

/**
 * The room spine, now that it has a face.
 *
 * `?fast=80` scales the room's clock rather than faking the page's: clock
 * faking is per-page, and once guests live in other pages it would
 * desynchronise the room. `?seed=42` fixes the shuffle so the run is
 * reproducible.
 *
 * The phase is read from `main[data-phase]` — an attribute rather than visible
 * copy, so these assertions survive every screen being rewritten around them.
 */
const HARNESS = '/room/DEV?seed=42&bots=4&fast=80'

test.describe('the room', () => {
  test('walks the whole flow to the podium without stalling', async ({ page }) => {
    // Five rounds is ~12s of room time at 80x, but this shares a machine with
    // every other spec. The config's 45s default applies to the whole test, so
    // an `expect` timeout above it would simply never be reached.
    test.setTimeout(90_000)
    await page.goto(HARNESS)

    const room = page.locator('main[data-phase]')
    await expect(room).toHaveAttribute('data-phase', 'lobby')

    // Generous: this asserts the room never stalls, not that it hits a
    // particular wall-clock time. Untimed phases (reveal, score) only advance
    // because something taps "Next round" — the autopilot under `?bots=`
    // today, a real button once the screens land.
    await expect(room).toHaveAttribute('data-phase', 'podium', { timeout: 60_000 })

    // Somebody won something. An empty scoreboard at the podium would mean the
    // flow advanced without anyone actually competing.
    await expect(page.getByText('Crown the winner')).toHaveCount(0)
    await expect(page.locator('main[data-phase] li, main[data-phase] [class*="row"]').first())
      .toBeVisible()
  })

  test('keeps the chrome live all the way through', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&fast=1')

    // The header names the step, the clock counts, and the rail drains — the
    // three things the phase-2 gate calls "real".
    await expect(page.getByRole('timer')).toBeVisible()
    const first = await page.getByRole('timer').textContent()
    await expect
      .poll(async () => page.getByRole('timer').textContent(), { timeout: 8_000 })
      .not.toBe(first)
  })

  test('rejects a room code that is not a room code', async ({ page }) => {
    const response = await page.goto('/room/not-a-code')
    expect(response?.status()).toBe(404)
  })

  test('does not scroll horizontally at mobile width', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=score')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'score')
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflows).toBe(false)
  })
})
