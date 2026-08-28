import { expect, test, type Page } from '@playwright/test'

/** `md` is 768px — the breakpoint the reveal reflows at. */
function wide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 768
}

/**
 * The endgame: reveal, scoreboard, podium.
 *
 * All three are untimed by design, so the host's button is the only way out of
 * the first two — which is exactly why a guest must not be shown one.
 */
test.describe('the reveal', () => {
  test('names the winner and pays out the round', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=reveal&gifs=stub')

    await expect(page.getByRole('heading', { name: /you (legend|monster)\./ })).toBeVisible()
    await expect(page.getByText(/ranking points? this round/)).toBeVisible()
  })

  test('tells a phone where you came, and a desktop who else placed', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=reveal&as=p2&gifs=stub')

    // Two rows of runners-up have no room on a phone, so the small screen gets
    // the one line that is actually about you instead.
    if (wide(page)) {
      await expect(page.getByText('Runners up')).toBeVisible()
      await expect(page.getByText(/^You finished /)).toBeHidden()
    } else {
      await expect(page.getByText(/^You finished /)).toBeVisible()
      await expect(page.getByText('Runners up')).toBeHidden()
    }
  })

  test('records your own reaction without inventing a tally', async ({ page }) => {
    // Nothing publishes a reaction until the event lane lands, so the bar
    // remembers your taps and claims nothing about anyone else's. It is a
    // desktop affordance in the design — a phone reveal is the card and the CTA.
    test.skip(!wide(page), 'the reaction bar is desktop-only')
    await page.goto('/room/DEV?seed=42&phase=reveal&gifs=stub')

    const fire = page.getByRole('button', { name: 'React with Fire' })
    await expect(fire).toHaveAttribute('aria-pressed', 'false')
    await fire.click()
    await expect(fire).toHaveAttribute('aria-pressed', 'true')
  })

  test('offers the advance to the host only', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=reveal&gifs=stub')
    await expect(page.getByRole('button', { name: 'See the scoreboard' })).toBeVisible()

    // `round/advanced` is host-only, so a guest's button could only ever
    // produce a refusal snackbar.
    await page.goto('/room/DEV?seed=42&phase=reveal&as=p2&gifs=stub')
    await expect(page.getByRole('button', { name: 'See the scoreboard' })).toHaveCount(0)
  })
})

test.describe('the scoreboard', () => {
  test('ranks the room and says who sets up next', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=score&gifs=stub')

    await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
    await expect(page.getByText(/has taken the lead and is being unbearable about it\./)).toBeVisible()
    await expect(page.getByText(/^Next captionist: /)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start round 2' })).toBeVisible()
  })

  test('calls the next role by the mode’s name for it', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=score&mode=react&gifs=stub')

    await expect(page.getByText(/^Next prompter: /)).toBeVisible()
  })

  test('advances the round', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=score&gifs=stub')

    await page.getByRole('button', { name: 'Start round 2' }).click()
    // A new round opens on the interstitial, not straight into the brief.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'opener')
  })
})

test.describe('the podium', () => {
  test('crowns a champion and offers the two ways on', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=podium&gifs=stub')

    await expect(page.getByText('Captionist of the sprint')).toBeVisible()
    await expect(page.getByRole('heading', { name: / takes the crown\./ })).toBeVisible()
    await expect(page.getByText(/and zero remorse\./)).toBeVisible()

    // The scoreboard's CTA must not follow the game here.
    await expect(page.getByText('Crown the winner')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Rematch with the same crew' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the start' })).toBeVisible()
  })

  test('rematches with the same crew', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=podium&gifs=stub')

    await page.getByRole('button', { name: 'Rematch with the same crew' }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
    // Same roster, cleared history.
    await expect(page.getByText(/5 players ready/)).toBeVisible()
  })
})
