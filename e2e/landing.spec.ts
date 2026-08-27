import { expect, test } from '@playwright/test'

// Selector policy: getByRole > data-testid > CSS. Never target hashed
// `.module.scss` class names — they change on every build.

test.describe('the landing page', () => {
  test('sells the format and offers both ways in', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Caption this.')
    await expect(page.getByText(/five-minute standup warmup/)).toBeVisible()
    await expect(page.getByText('3–20 players · no install · works in a Zoom share')).toBeVisible()

    // Both paths, given equal weight: start one, or join one.
    await expect(page.getByRole('button', { name: 'Start a game — it’s free' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Join a room' })).toBeVisible()
  })

  test('starts a room and lands in its lobby', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start a game — it’s free' }).click()

    // A generated code, and a real room behind it.
    await expect(page).toHaveURL(/\/room\/C-[346789A-HJKMNPQRTUVWXY]{6}$/)
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
  })

  test('blocks the join until the code is whole, and says how much is missing', async ({
    page,
  }) => {
    await page.goto('/')

    const join = page.getByRole('button', { name: 'Enter 6 more' })
    await expect(join).toBeVisible()
    await expect(join).not.toBeDisabled()

    // Typed with the ambiguous digits a person actually reaches for when a
    // code is read to them: 0 for Q, 1 for J. The normaliser folds both.
    await page.getByRole('textbox').first().fill('F01783')
    await expect(page.getByRole('button', { name: 'Join the room' })).toBeVisible()

    await page.getByRole('button', { name: 'Join the room' }).click()
    await expect(page).toHaveURL(/\/room\/C-FQJ783$/)
  })

  test('renders the whole wall in the first response, not after hydration', async ({
    page,
  }) => {
    // Server-rendered: the tiles are in the HTML the server sent, so the wall
    // is complete and correctly sized before any script runs. That is what
    // keeps it from shifting the layout underneath the headline.
    const response = await page.request.get('/')
    const html = await response.text()
    expect(html.split('/media/stub-').length - 1).toBeGreaterThanOrEqual(20)
  })

  test('lets anyone stop the background', async ({ page }) => {
    await page.goto('/')

    const stills = () =>
      page.locator('img[src*="-still"]').count()

    // Motion is on by default and is a swap away from stopping.
    await expect.poll(stills).toBe(0)
    await page.getByRole('button', { name: 'Pause background' }).click()
    await expect.poll(stills).toBe(20)

    await page.getByRole('button', { name: 'Play background' }).click()
    await expect.poll(stills).toBe(0)
  })

  test('does not scroll horizontally', async ({ page }) => {
    await page.goto('/')
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflows).toBe(false)
  })
})

test.describe('the landing page, with reduced motion', () => {
  test('never plays a frame, and does not offer to', async ({ page }) => {
    // Set explicitly rather than through `test.use`, which does not reach the
    // page's own `matchMedia` here.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Stillness is the file, not a media query: an SVG used as an image does
    // not reliably inherit the page's preference, so the tile has to be a
    // different asset rather than the same one told to hold still.
    await expect.poll(() => page.locator('img[src*="-still"]').count()).toBe(20)

    // Offering a pause control to someone who already asked for stillness is
    // noise.
    await expect(page.getByRole('button', { name: /background/ })).toHaveCount(0)
  })
})
