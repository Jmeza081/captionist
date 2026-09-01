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

/**
 * A board has landed, whether or not it had anything on it.
 *
 * The attribution mark renders from the descriptor of whoever actually
 * answered, so it appears exactly when a response has been applied. The call
 * counters below serve *empty* boards deliberately — they are measuring
 * requests, not tiles — so waiting on a tile there would wait forever.
 */
function boardLanded(page: Page) {
  return page.getByText(/Powered by (KLIPY|Giphy)/)
}

/** An empty board, in whichever provider's shape was asked for. */
function emptyBoard(url: string): string {
  // Klipy's envelope is double-nested and Giphy's is flat. `{ data: [] }` would
  // satisfy both by accident, which would let this pass against a fiction.
  return url.includes('klipy')
    ? JSON.stringify({ result: true, data: { data: [], current_page: 1, per_page: 50, has_next: false } })
    : JSON.stringify({ data: [] })
}

/**
 * Answers every provider's call with an empty board, and counts them.
 *
 * Both are routed rather than whichever happens to be default, so the budget
 * these tests guard — the thing ADR-0021 rests on — keeps being measured
 * through a provider swap instead of silently measuring nothing.
 */
async function countCalls(page: Page): Promise<() => number> {
  let calls = 0
  for (const glob of [GIPHY, KLIPY]) {
    await page.route(glob, async (route) => {
      const url = route.request().url()
      // The share trigger is a pick being reported, not a board being fetched.
      if (url.includes('/gifs/share/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
        return
      }
      /**
       * Boards only.
       *
       * `gifs/items` is the landing wall, the backdrop and the 404 resolving
       * their slugs — a real call, counted in the ledger, and not part of the
       * per-round search budget these tests exist to hold. Lumping them in
       * would make the ADR-0021 guard drift every time a decoration moved.
       */
      if (!url.includes('/gifs/items')) calls += 1
      await route.fulfill({ status: 200, contentType: 'application/json', body: emptyBoard(url) })
    })
  }
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
    // Names whoever *would* have answered, so a fresh clone is told which key
    // to go and get. That is the default provider, not the board's — there
    // isn't one.
    await expect(page.getByText(/no KLIPY key configured/i)).toBeVisible()
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

test.describe('the search budget, which is gone', () => {
  test('says nothing about a budget, and never stops taking searches', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')
    await expect(tiles(page).first()).toBeVisible()

    // The inverse of what this group used to assert. ADR-0021 rationed three
    // searches a round against Giphy's 100 an hour and put a counter above the
    // board; ADR-0026 removed the ration with the allowance behind it. A
    // counter that rations nothing would be worse than none.
    await expect(page.getByText(/searches left/)).toHaveCount(0)
    await expect(page.getByText(/No searches left/)).toHaveCount(0)

    // Well past the old ceiling of three, through both roads that used to
    // spend one: the field, and a suggestion chip.
    const search = page.getByRole('textbox', { name: 'Search GIFs' })
    for (const term of ['prod', 'merge', 'rollback', 'oncall', 'retro', 'standup']) {
      await search.fill(term)
      await search.press('Enter')
      await expect(tiles(page).first()).toBeVisible()
    }

    const chip = page.getByRole('button', { name: 'deploy on friday' }).first()
    await expect(chip).toBeEnabled()
    await chip.click()
    await expect(tiles(page).first()).toBeVisible()
    await expect(page.getByText(/searches left/)).toHaveCount(0)
  })
})

test.describe('the allowance', () => {
  test('spends one call arriving, and exactly one per search', async ({ page }) => {
    const calls = await countCalls(page)
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=live')

    // Measured as a delta rather than an absolute, because `reactStrictMode`
    // makes the arrival *fetch* twice in development — mount, tear down,
    // mount. Production runs the effect once.
    await expect(boardLanded(page)).toBeVisible()
    const afterArriving = calls()
    expect(afterArriving).toBeGreaterThan(0)

    // A search is exactly one call. No debounce means no burst of them, and
    // that is still worth pinning now that nothing rations them — a picker
    // that fired per keystroke would be a bandwidth bill instead of an API
    // one. See ADR-0026.
    const search = page.getByRole('textbox', { name: 'Search GIFs' })
    await search.fill('prod')
    await search.press('Enter')
    await expect.poll(calls).toBe(afterArriving + 1)

    // Three more, one call each, past where the old budget stopped.
    for (const term of ['merge', 'rollback', 'oncall']) {
      await search.fill(term)
      await search.press('Enter')
    }
    await expect.poll(calls).toBe(afterArriving + 4)
  })

  test('shuffles to another board for exactly one more call', async ({ page }) => {
    const calls = await countCalls(page)
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=live')
    await expect(boardLanded(page)).toBeVisible()
    const afterArriving = calls()

    // ADR-0021 deleted this control as "a third drain on the budget" and kept
    // `GifCursor` threaded through for the day it came back. One call, like a
    // search — it is a search, for the same query on the next page.
    await page.getByRole('button', { name: /Shuffle results/ }).click()
    await expect.poll(calls).toBe(afterArriving + 1)
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
    // Whoever is answering: a spent allowance ends the room the same way, and
    // 429 is the one signal both providers agree on.
    for (const glob of [GIPHY, KLIPY]) {
      await page.route(glob, (route) =>
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Too Many Requests' }),
        }),
      )
    }

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

/**
 * The ledger, which exists to turn ADR-0021's arithmetic into a measurement.
 *
 * A counter that quietly stopped counting would be worse than none: the number
 * it produces is going into a production-key application, and nothing on screen
 * would look wrong. So the guard is that a board and a pick both leave a trace.
 */
test.describe('counting what the room costs', () => {
  test('records a call per board, and the pick that followed', async ({ page }) => {
    await page.route(KLIPY, async (route) => {
      const url = route.request().url()
      // The share trigger is a POST to /gifs/share/<slug> and answers a bare ok.
      if (url.includes('/gifs/share/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ result: true, data: [] }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: true,
          data: {
            data: [
              {
                slug: 'a-gif--tok',
                title: 'A tile',
                type: 'gif',
                tags: [],
                file: {
                  md: {
                    gif: { url: 'https://static.klipy.com/a.gif', width: 220, height: 220 },
                    webp: { url: 'https://static.klipy.com/a.webp', width: 220, height: 220 },
                  },
                },
              },
            ],
            current_page: 1,
            per_page: 50,
            has_next: false,
          },
        }),
      })
    })

    await page.goto('/room/DEV?seed=42&phase=brief&gifs=klipy')
    await expect(tiles(page).first()).toBeVisible()

    const read = async () =>
      JSON.parse(
        (await page.evaluate(() => localStorage.getItem('captionist:gif-usage:v1'))) ?? '[]',
      ) as { provider: string; kind: string; n: number }[]

    const arriving = await read()
    expect(arriving.some((row) => row.provider === 'klipy' && row.kind === 'trending')).toBe(true)
    // Never the offline shelf: counting free boards would inflate the one
    // number this exists to get right.
    expect(arriving.some((row) => row.provider === 'sample')).toBe(false)

    await tiles(page).first().click()

    // Klipy's attribution depends on hearing about a pick, and the id it takes
    // is dropped by `toMediaRef` a moment later — so if this is ever not
    // recorded, the trigger has stopped firing at the only moment it can.
    await expect(async () => {
      expect((await read()).some((row) => row.kind === 'share')).toBe(true)
    }).toPass()
  })

  test('counts nothing at all over the offline shelf', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')
    await expect(tiles(page).first()).toBeVisible()

    const ledger = await page.evaluate(() => localStorage.getItem('captionist:gif-usage:v1'))
    expect(ledger === null || ledger === '[]').toBe(true)
  })
})

/**
 * The ad slot, whose ordinary state is absent.
 *
 * Ads are never guaranteed even when asked for, and no money here depends on
 * one arriving — so "no ad" is the case the layout is designed around and the
 * one worth guarding hardest.
 */
test.describe('advertising', () => {
  const board = (ads: unknown[]) =>
    JSON.stringify({
      result: true,
      data: {
        data: [
          {
            slug: 'a-gif--tok',
            title: 'A tile',
            type: 'gif',
            tags: [],
            file: {
              md: {
                gif: { url: 'https://static.klipy.com/a.gif', width: 220, height: 220 },
                webp: { url: 'https://static.klipy.com/a.webp', width: 220, height: 220 },
              },
            },
          },
          ...ads,
        ],
        current_page: 1,
        per_page: 50,
        has_next: false,
      },
    })

  async function serve(page: Page, ads: unknown[]) {
    await page.route(KLIPY, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: board(ads) }),
    )
  }

  test('shows nothing at all when no ad came back', async ({ page }) => {
    await serve(page, [])
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=klipy')
    await expect(tiles(page).first()).toBeVisible()

    // Not an empty box, not a "Sponsored" heading over nothing — absent.
    await expect(page.locator('iframe[title="Advertisement"]')).toHaveCount(0)
    await expect(page.getByText('Sponsored')).toHaveCount(0)
  })

  test('renders an ad above the board, in a sandbox that cannot reach us', async ({ page }) => {
    await serve(page, [
      { type: 'ad', width: 250, height: 100, content: '<html><body>ad one</body></html>' },
    ])
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=klipy')

    const ad = page.locator('iframe[title="Advertisement"]')
    await expect(ad).toHaveCount(1)

    // `allow-same-origin` alongside `allow-scripts` would hand a third party
    // this app's origin — its storage, its cookies, its DOM. The sandbox is
    // the whole reason an ad may be rendered at all.
    const sandbox = await ad.getAttribute('sandbox')
    expect(sandbox).not.toContain('allow-same-origin')
    expect(sandbox).toContain('allow-scripts')

    // Above the board: an ad below fifty tiles is one nobody scrolls to.
    const adY = await ad.evaluate((e) => e.getBoundingClientRect().top + window.scrollY)
    const tileY = await tiles(page)
      .first()
      .evaluate((e) => e.getBoundingClientRect().top + window.scrollY)
    expect(adY).toBeLessThan(tileY)
  })

  test('renders every ad it was given, and none of them as a tile', async ({ page }) => {
    await serve(page, [
      { type: 'ad', width: 250, height: 100, content: '<html><body>one</body></html>' },
      { type: 'ad', width: 250, height: 100, content: '<html><body>two</body></html>' },
    ])
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=klipy')

    // Showing fewer than were returned would be suppressing them; showing one
    // as a tile would make an advertiser's HTML pickable.
    await expect(page.locator('iframe[title="Advertisement"]')).toHaveCount(2)
    await expect(tiles(page)).toHaveCount(1)
  })

  test('never lets an ad become the round’s subject', async ({ page }) => {
    await serve(page, [
      { type: 'ad', width: 250, height: 100, content: '<html><body>ad</body></html>' },
    ])
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=klipy')
    await expect(tiles(page).first()).toBeVisible()

    // "Surprise me" draws from the board. It must never reach the ad channel —
    // the types make that impossible, and this is the behavioural proof.
    await page.getByRole('button', { name: /Surprise/ }).click()
    await expect(page.locator('[class*="badge"]')).toHaveText('Selected')
    await expect(tiles(page)).toHaveCount(1)
  })
})

/**
 * The set behind a tile that has not got its picture yet.
 *
 * A board is fifty lazily-loaded tiles, and until this they were fifty
 * transparent boxes behind a hairline while the WebP decoded — and forever
 * where it never did. `TunedImage` puts `TvStatic` behind each one, which is
 * the same treatment the landing wall has given a cell since it shipped.
 *
 * Both tests block the media rather than racing the decode: a stub tile is a
 * local SVG and loads in single-digit milliseconds, so "before it loads" is not
 * a window a spec can stand in. Blocked, the static is the *settled* state and
 * the assertion is about what a dead channel does, not about timing.
 */
test.describe('a tile with no picture yet', () => {
  const PICKER = '/room/DEV?seed=42&phase=brief&gifs=stub'

  /** The set inside one tile — never a page-wide count, which proves nothing. */
  function staticIn(page: Page) {
    return tiles(page).first().locator('[data-testid="tv-static"]')
  }

  test('tunes a dead channel, and keeps it when the GIF never arrives', async ({ page }) => {
    await page.route('**/media/stub-*', (route) => route.abort())
    await page.goto(PICKER)
    await expect(tiles(page).first()).toBeVisible()

    // Never dropped on error, only on load. A GIF the provider has pulled is a
    // set that never tuned in, and saying so is better than the empty rectangle
    // this replaced.
    await expect(staticIn(page)).toBeVisible()

    // And still there once everything that was going to happen has. Without
    // this the test would pass on a static that appears and then vanishes with
    // the failed request, which is the version that leaves the hole back.
    await page.waitForLoadState('networkidle')
    const painted = await tiles(page)
      .first()
      .locator('img')
      .evaluate((img: HTMLImageElement) => img.naturalWidth)
    expect(painted).toBe(0)
    await expect(staticIn(page)).toBeVisible()
  })

  test('drops the static once the picture is there', async ({ page }) => {
    await page.goto(PICKER)
    await expect(tiles(page).first()).toBeVisible()

    // Gone rather than covered — `MediaCard` draws an unselected image at 85%,
    // and a field repainting five times every 200ms under a loaded GIF is a
    // bill for something nobody can see.
    await expect(staticIn(page)).toHaveCount(0)
  })
})
