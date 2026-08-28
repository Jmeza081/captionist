import { expect, test } from '@playwright/test'

// Selector policy: getByRole > data-testid > CSS. Never target hashed
// `.module.scss` class names — they change on every build.

test.describe('the landing page', () => {
  test('sells the format and offers both ways in', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Caption this.')
    await expect(page.getByText(/five-minute standup warmup/)).toBeVisible()
    await expect(page.getByText('3–20 players · no install · works in a Zoom share')).toBeVisible()

    // Both paths, given equal weight: start one, or join one. Both are links —
    // each is a navigation to a screen that asks the next question.
    await expect(page.getByRole('link', { name: 'Start a game — it’s free' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Join a room' })).toBeVisible()
  })

  test('sends a new host to set the room up first', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Start a game — it’s free' }).click()

    // The design's flow is landing → setup → lobby: the rules are decided
    // before the room exists, not after people are already in it.
    await expect(page).toHaveURL(/\/host$/)
    await expect(page.getByRole('button', { name: 'Open the room' })).toBeVisible()

    // And the defaults are playable as-is, so a host can leave without reading.
    await page.getByRole('button', { name: 'Open the room' }).click()
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
    await page.getByRole('textbox', { name: 'Room code' }).fill('F01783')
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(page).toHaveURL(/\/room\/C-FQJ783$/)
  })

  test('masks the code as one field, not the join route’s slots', async ({ page }) => {
    await page.goto('/')

    // The landing control is a single masked field on glass. `/join`'s
    // seven-slot grid is a different component for a different job — one is a
    // glance beside a headline, the other is the whole screen.
    await expect(page.getByRole('textbox', { name: 'Room code' })).toHaveCount(1)

    await page.getByRole('textbox', { name: 'Room code' }).fill('F34')
    // What is typed, then a rail for what is left.
    await expect(page.locator('form[class*="QuickJoin"]')).toContainText('C-F34___')
  })

  test('never changes width as the code is typed', async ({ page }) => {
    await page.goto('/')
    const pill = page.locator('form[class*="QuickJoin"]')
    const field = page.getByRole('textbox', { name: 'Room code' })

    const widths = new Set<number>()
    // `W` and `I` are the widest and narrowest glyphs in a proportional face,
    // and the key's label counts down from "Enter 6 more" to "Join" — every
    // one of those is a chance for the pill to move under someone's cursor.
    for (const code of ['', 'F', 'F34', 'F34783', 'WWWWWW', 'IIIIII']) {
      await field.fill(code)
      widths.add(Math.round((await pill.boundingBox())!.width))
    }
    expect(widths.size).toBe(1)
  })

  test('sits the two calls to action at the same height', async ({ page }) => {
    await page.goto('/')

    const start = (await page.getByRole('link', { name: /Start a game/ }).boundingBox())!
    const pill = (await page.locator('form[class*="QuickJoin"]').boundingBox())!
    expect(Math.round(pill.height)).toBe(Math.round(start.height))

    // The key inside the pill still clears the 44px touch target — matching
    // the heights must not be done by shrinking what people tap.
    const key = (await page.getByRole('button', { name: /Enter|^Join$/ }).boundingBox())!
    expect(key.height).toBeGreaterThanOrEqual(44)
  })

  test('carries the caret on the cell that fills next', async ({ page }) => {
    await page.goto('/')
    const field = page.getByRole('textbox', { name: 'Room code' })
    await field.click()
    await field.fill('F34')

    // The native caret is hidden — a transparent input places it by its own
    // text layout, which is nowhere near the mask.
    await expect(field).toHaveCSS('caret-color', 'rgba(0, 0, 0, 0)')

    // Exactly one cell is marked, and it is the fourth.
    const cells = page.locator('form[class*="QuickJoin"] span[class*="cell"]')
    await expect(cells).toHaveCount(6)
    const marked = await cells.evaluateAll((els) =>
      els.map((el) => el.className.includes('caret')),
    )
    expect(marked).toEqual([false, false, false, true, false, false])
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

  test('fills every cell of the wall, at any window the grid is asked for', async ({
    page,
  }) => {
    // The wall's tile count is fixed at twenty, so the grid has to declare
    // exactly twenty cells at every viewport or the leftover ones show as
    // holes in the page's background. It used to size the tile and let the
    // column count fall out of the window, which was full only at the widths
    // where the columns happened to divide twenty.
    for (const size of [
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
      { width: 1600, height: 900 },
      { width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize(size)
      await page.goto('/')

      const wall = page.getByTestId('hero-wall')
      const cells = await wall.evaluate((grid) => {
        const style = getComputedStyle(grid)
        const tracks = (axis: string) => style.getPropertyValue(axis).split(' ').length
        return { declared: tracks('grid-template-columns') * tracks('grid-template-rows') }
      })

      expect(cells.declared, `${size.width}x${size.height}`).toBe(20)
      await expect(wall.locator('> div')).toHaveCount(20)
    }
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

  test('wears the faces you can actually pick', async ({ page }) => {
    await page.goto('/')

    // The proof row used to be five initials on coloured circles. It is now the
    // first five seeds of the picker's catalogue, so the row is a sample of the
    // thing it is claiming — five people, five faces you could choose.
    const faces = page.locator('[class*="faces"] img')
    await expect(faces).toHaveCount(5)
    for (const src of await faces.evaluateAll((els) => els.map((el) => el.getAttribute('src')))) {
      expect(src).toMatch(/^data:image\/svg\+xml/)
    }
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
