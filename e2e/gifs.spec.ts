import { expect, test, type Page } from '@playwright/test'

/**
 * The picker, from the browser — which is now the only place it runs.
 *
 * This spec used to drive `/api/gifs` through `request`, because the app
 * proxied Giphy through a route handler. It does not any more: proxying and
 * caching are both against Giphy's terms, so the route is gone and every board
 * is a live call from the page. See ADR-0020.
 *
 * `the allowance` is the group that holds ADR-0021 up. The room's cost is
 * bounded by a per-round search budget, and these assert that budget exactly
 * rather than counting a whole game and hoping: a page only ever sees its
 * *own* seat's calls, so a full-game total from one browser would be a number
 * that looks like proof and is not.
 *
 * `?gifs=stub` is the same switch `NEXT_PUBLIC_GIFS_STUB` throws, so CI never
 * needs a key and never burns rate limit. `?gifs=live` opts one page load back
 * onto the real path, which is what makes the interception below count
 * something.
 */

const GIPHY = '**api.giphy.com/**'
const KLIPY = '**api.klipy.com/**'

/** A GIF tile is the only button on the screen wrapping an image. */
function tiles(page: Page) {
  return page.locator('button:has(img)')
}

/** Answers every Giphy call with an empty board, and counts them. */
async function countCalls(page: Page): Promise<() => number> {
  let calls = 0
  await page.route(GIPHY, async (route) => {
    calls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
  return () => calls
}

test.describe('the picker, without a key', () => {
  test('draws the offline shelf rather than an error', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')

    await expect(tiles(page).first()).toBeVisible()

    // Every tile is named: `alt` becomes the accessible name here and
    // `MediaRef.alt` in game state for the rest of the round, so an empty one
    // is never acceptable.
    const names = await tiles(page).evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('aria-label') ?? ''),
    )
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) expect(name.trim().length).toBeGreaterThan('Pick '.length)
    expect(new Set(names).size).toBe(names.length)
  })

  test('credits nobody when the board is the offline shelf', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')
    await expect(tiles(page).first()).toBeVisible()

    // The attribution mark is required where the API is used — and a false
    // claim everywhere else. This board is the offline shelf, so *no* provider
    // may be named, not merely the one that happens to be configured.
    await expect(page.getByText('Powered by Giphy')).toHaveCount(0)
    await expect(page.getByText('Powered by KLIPY')).toHaveCount(0)
    await expect(page.getByText(/no Giphy key configured/i)).toBeVisible()
  })

  test('never lets a board go blank', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')
    await expect(tiles(page).first()).toBeVisible()

    // A search that matches nothing falls back to the whole shelf: a blank
    // grid reads as broken.
    const search = page.getByRole('textbox', { name: 'Search GIFs' })
    await search.fill('zzzzzzz')
    await search.press('Enter')
    await expect(tiles(page).first()).toBeVisible()
  })
})

test.describe('the budget', () => {
  test('gives the arrival board away, then counts down the three', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')
    await expect(tiles(page).first()).toBeVisible()

    // Three a round, and the board you arrive on is not one of them. Said
    // before the chips are tapped, not after: they read as free, and each one
    // costs a search.
    await expect(page.getByText('3 searches left.')).toBeVisible()

    const search = page.getByRole('textbox', { name: 'Search GIFs' })
    for (const [term, left] of [
      ['prod', '2 searches left.'],
      ['merge', 'One search left.'],
    ] as const) {
      await search.fill(term)
      await search.press('Enter')
      await expect(page.getByText(left)).toBeVisible()
    }

    await search.fill('rollback')
    await search.press('Enter')
    await expect(page.getByText(/No searches left/)).toBeVisible()
  })

  test('blocks the chips without disabling them', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')
    await expect(tiles(page).first()).toBeVisible()

    const search = page.getByRole('textbox', { name: 'Search GIFs' })
    for (const term of ['prod', 'merge', 'rollback']) {
      await search.fill(term)
      await search.press('Enter')
    }
    await expect(page.getByText(/No searches left/)).toBeVisible()

    // Non-negotiable #10. A spent chip stays live and focusable and the
    // counter says why; a greyed-out inert one is what this forbids.
    const chip = page.getByRole('button', { name: 'deploy on friday' }).first()
    await expect(chip).toBeEnabled()
    await chip.focus()
    await expect(chip).toBeFocused()
  })
})

test.describe('the allowance', () => {
  test('spends one call arriving, one per search, then stops at three', async ({
    page,
  }) => {
    const calls = await countCalls(page)
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=live')

    // Measured as a delta rather than an absolute, because `reactStrictMode`
    // makes the arrival *fetch* twice in development — mount, tear down,
    // mount. Production runs the effect once. Arriving costs no budget either
    // way; what is asserted is that a search costs exactly one call and that
    // the fourth one costs nothing at all.
    await expect(page.getByText('3 searches left.')).toBeVisible()
    const afterArriving = calls()
    expect(afterArriving).toBeGreaterThan(0)

    // A search is exactly one call. No debounce means no burst of them.
    const search = page.getByRole('textbox', { name: 'Search GIFs' })
    await search.fill('prod')
    await search.press('Enter')
    await expect(page.getByText('2 searches left.')).toBeVisible()
    expect(calls()).toBe(afterArriving + 1)

    // And the cap holds against someone who keeps trying — through the field
    // and through a chip, which are the two ways to spend one. Three a round
    // is what the room's cost model rests on; see ADR-0021 for what that
    // buys and what it costs.
    for (const term of ['merge', 'rollback', 'oncall', 'retro']) {
      await search.fill(term)
      await search.press('Enter')
    }
    await page.getByRole('button', { name: 'deploy on friday' }).first().click()
    await expect(page.getByText(/No searches left/)).toBeVisible()
    expect(calls()).toBe(afterArriving + 3)
  })

  test('costs nothing on a screen with no picker', async ({ page }) => {
    const calls = await countCalls(page)

    // `promptwait` — watching the Prompter type. This is the regression that
    // mattered most: the hook sat above the early returns, so every player in
    // the room paid for a board nobody was ever shown.
    await page.goto('/room/DEV?seed=42&phase=brief&mode=react&as=p2&gifs=live')
    await expect(page.getByText(/is typing a prompt/)).toBeVisible()

    expect(calls()).toBe(0)
  })

  test('ends the game when the allowance is gone, and says why', async ({ page }) => {
    await page.route(GIPHY, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Too Many Requests' }),
      }),
    )

    await page.goto('/room/DEV?seed=42&phase=brief&gifs=live')

    // Not an error in the picker — the room stops. Scores stand from whatever
    // completed, which is what `round: null` plus the podium path gives.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'podium')
    await expect(page.getByText('Nobody paid the GIF bill')).toBeVisible()

    // A modal nobody asked for must not be a trap.
    await page.getByRole('button', { name: 'Got it' }).click()
    await expect(page.getByText('Nobody paid the GIF bill')).toBeHidden()
  })
})

/**
 * Which provider answered, and whether the page says so truthfully.
 *
 * This group exists because of a real bug. `useGifSearch` first derived the
 * attribution mark from the *configured* provider rather than from the board
 * that came back — which looks equivalent and is not, because `?gifs=` pins a
 * provider for one page load without touching the environment. A board of
 * KLIPY's GIFs rendered "Powered by Giphy" under it: a false attribution, and
 * exactly the failure the descriptor was introduced to make impossible.
 *
 * Both providers are exercised through a real browser, because the seam is only
 * as good as its second implementation.
 */
test.describe('choosing a provider', () => {
  /** Answers one provider with a board of nothing, in that provider's own shape. */
  async function stub(page: Page, glob: string, body: unknown) {
    await page.route(glob, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })
  }

  test('sends the board to Klipy, and credits Klipy for it', async ({ page }) => {
    const called: string[] = []
    await page.route(KLIPY, async (route) => {
      called.push(route.request().url())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Klipy's envelope is double-nested. `{ data: [] }` would coincidentally
        // yield an empty board too, which would make this pass against a fiction.
        body: JSON.stringify({
          result: true,
          data: { data: [], current_page: 1, per_page: 50, has_next: false },
        }),
      })
    })

    await page.goto('/room/DEV?seed=42&phase=brief&gifs=klipy')
    await expect(page.getByText('Powered by KLIPY · SFW filter on')).toBeVisible()

    // Not an absolute count: `reactStrictMode` makes the arrival fetch twice in
    // development, which `the allowance` above documents and measures around.
    // What matters here is *who* was called and how the request was shaped.
    expect(called.length).toBeGreaterThan(0)
    const url = new URL(called[0]!)
    expect(url.pathname).toContain('/gifs/trending')
    // The app key is a path segment, and must never reach the query string —
    // the trap a client ported carelessly from the Giphy one falls into.
    expect(url.pathname).toContain('e2e-not-a-real-key')
    expect(url.search).not.toContain('e2e-not-a-real-key')
    // Klipy fails open: without this parameter it returns exactly what `off`
    // returns, under a picker that promises "SFW filter on".
    expect(url.search).toContain('content_filter=high')
    // And never `format_filter`, which would strip the WebP the board renders.
    expect(url.search).not.toContain('format_filter')
    // The mandated placeholder, which is the one attribution that is required
    // rather than recommended.
    await expect(page.getByRole('textbox', { name: 'Search GIFs' })).toHaveAttribute(
      'placeholder',
      'Search KLIPY',
    )
    await expect(page.getByText('Powered by Giphy')).toHaveCount(0)
  })

  test('sends the board to Giphy, and credits Giphy for it', async ({ page }) => {
    await stub(page, GIPHY, { data: [] })

    await page.goto('/room/DEV?seed=42&phase=brief&gifs=giphy')
    await expect(page.getByText('Powered by Giphy · SFW filter on')).toBeVisible()
    await expect(page.getByText('Powered by KLIPY')).toHaveCount(0)
  })

  test('keeps one accessible name whoever is answering', async ({ page }) => {
    // The brand rides the placeholder; the accessible name does not move. A
    // locator that changed with the configured provider would be untestable.
    await stub(page, KLIPY, {
      result: true,
      data: { data: [], current_page: 1, per_page: 50, has_next: false },
    })
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=klipy')
    await expect(page.getByRole('textbox', { name: 'Search GIFs' })).toBeVisible()

    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')
    await expect(page.getByRole('textbox', { name: 'Search GIFs' })).toBeVisible()
  })
})
