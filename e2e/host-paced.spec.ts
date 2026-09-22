import { expect, test } from '@playwright/test'

/**
 * A room the host paces: no phase clocks, and a tap is the only thing that
 * moves it on.
 *
 * `?paced=1` boots the fixture with `hostPaced` set, for the same reason
 * `?voting=` and `?format=` exist — every fixture takes `DEFAULT_SETTINGS`,
 * and walking `/host` → `sessionStorage` → a room would drag a route boundary
 * into a screen spec.
 *
 * The claim under test is mostly an *absence*: the backlog expected a timer
 * reading `0:00`, and the honest render is no timer at all.
 */
test.describe('host-paced rooms', () => {
  test('draws no clock where a timed room draws one', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&paced=1&as=p2&gifs=stub')

    // `role="timer"` is `TimerPill`'s own handle. Not present, rather than
    // present and frozen — ADR 0015: a progress element may not invent a stage.
    await expect(page.getByRole('timer')).toHaveCount(0)
  })

  test('still draws one in a room that kept its clocks', async ({ page }) => {
    // The control. Without it the assertion above passes on any broken room.
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')

    await expect(page.getByRole('timer')).toBeVisible()
  })

  test('gives the host the way out that the clock used to be', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&paced=1&gifs=stub')

    const advance = page.getByRole('button', { name: 'Close the vote' })
    await expect(advance).toBeVisible()

    // Verb-first and names the outcome, per §5 — never "Next".
    await advance.click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', /reveal|tiebreak/)
  })

  test('gives a guest no button and names who they are waiting on', async ({ page }) => {
    // A control a guest cannot use is a lie about whose room it is. They get
    // the host's name in the body copy instead.
    await page.goto('/room/DEV?seed=42&phase=waiting&out=1&paced=1&as=p2&gifs=stub')

    await expect(page.getByRole('button', { name: 'Close the vote' })).toHaveCount(0)
    await expect(page.locator('main[data-phase]')).toContainText('when Jesse opens the vote')
    await expect(page.locator('main[data-phase]')).not.toContainText('the clock hits zero')
  })

  test('says "you" to the host who will do the opening', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=waiting&out=1&paced=1&gifs=stub')

    await expect(page.locator('main[data-phase]')).toContainText('when you open the vote')
  })

  test('advances on ⌥↵ for the host, and not for a guest', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&paced=1&gifs=stub')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote')

    await page.keyboard.press('Alt+Enter')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', /reveal|tiebreak/)
  })

  test('ignores the shortcut for a guest, who cannot advance anything', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&paced=1&as=p2&gifs=stub')

    await page.keyboard.press('Alt+Enter')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote')
  })

  test('still ends a phase on consensus, with nobody tapping anything', async ({ page }) => {
    // The point of leaving `settleGates` alone. Every competitor is in, so the
    // room moves itself on — a paced room is not a room that stops working.
    await page.goto('/room/DEV?seed=42&phase=waiting&paced=1&as=p2&gifs=stub')

    await expect(page.getByText('That’s everyone in.')).toBeVisible()
    // `WAITING_ALL_IN_MS` survives: it reads off the tracker, not the duration
    // table, so the read-your-confirmation beat is still three seconds.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote', {
      timeout: 10_000,
    })
  })
})

test.describe('the pacing setting', () => {
  test('is on the host form and quiets the cap beside it', async ({ page }) => {
    await page.goto('/host')

    const paced = page.getByRole('switch', { name: 'Advance each phase yourself' })
    await expect(paced).toBeVisible()
    await expect(paced).toHaveAttribute('aria-checked', 'false')

    await paced.click()
    await expect(paced).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('No clock to cap while you’re pacing the room.')).toBeVisible()
  })
})
