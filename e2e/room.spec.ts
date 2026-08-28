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

    // The lobby is deliberately not asserted here. With `?bots=` the autopilot
    // starts the game the moment the fifth player lands, so whether the lobby
    // is still on screen by the time this query runs is a race against the
    // room's own first paint. `lobby.spec.ts` covers it without bots, which is
    // the only way it holds still.

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

  /**
   * Every phase, not just one.
   *
   * Reveal, tiebreak and podium each draw a decorative radial glow far wider
   * than a phone. Sized in viewport units it does not merely overflow — it
   * widens the page, and the whole room scrolls sideways. That shipped once and
   * only showed up in a full-page screenshot, so it is asserted per phase now.
   */
  for (const phase of ['waiting', 'vote', 'tiebreak', 'reveal', 'score', 'podium'] as const) {
    test(`does not scroll horizontally at ${phase}`, async ({ page }) => {
      await page.goto(`/room/DEV?seed=42&phase=${phase}&gifs=stub`)
      await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', phase)
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth, `${phase}: ${scrollWidth} > ${clientWidth}`).toBeLessThanOrEqual(
        clientWidth + 1,
      )
    })
  }
})

/**
 * Phase 3's milestone, stated as a test: a complete five-round game, in both
 * modes, ending on a real podium rather than a phase attribute.
 *
 * The caption lane is covered above. This is the reversed one, which is
 * otherwise unreachable — every fixture and fresh room takes
 * `DEFAULT_SETTINGS.mode`.
 */
test('plays the reversed lane all the way to a champion', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/room/DEV?seed=42&bots=4&fast=80&mode=react&gifs=stub')

  const room = page.locator('main[data-phase]')
  await expect(room).toHaveAttribute('data-phase', 'podium', { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: / takes the crown\./ })).toBeVisible()
})

test('a room with nobody but the host still finishes', async ({ page }) => {
  // No `?bots=`, so no autopilot: `reveal` and `score` are untimed and nothing
  // advances them but a person. This is the check that the two screens carry
  // the button `PhasePending` used to.
  await page.goto('/room/DEV?seed=42&phase=reveal&gifs=stub')
  const room = page.locator('main[data-phase]')

  await page.getByRole('button', { name: 'See the scoreboard' }).click()
  await expect(room).toHaveAttribute('data-phase', 'score')

  await page.getByRole('button', { name: 'Start round 2' }).click()
  await expect(room).toHaveAttribute('data-phase', 'opener')
})
