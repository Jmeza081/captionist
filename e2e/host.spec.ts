import { expect, test } from '@playwright/test'

/**
 * The only screen where the room's rules are decided.
 *
 * The design's note is the requirement: "Defaults are playable as-is so a host
 * can hit 'Open the room' without reading anything."
 */
test.describe('setting a room up', () => {
  test('opens a playable room without a single decision', async ({ page }) => {
    await page.goto('/host')
    await page.getByRole('button', { name: 'Open the room' }).click()

    await expect(page).toHaveURL(/\/room\/C-[346789A-HJKMNPQRTUVWXY]{6}$/)
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
    // `DEFAULT_SETTINGS`, read back off the room's own header.
    await expect(page.getByText('Caption the image · 5 rounds · 90s · rank top 3')).toBeVisible()
  })

  test('carries the chosen rules into the room', async ({ page }) => {
    await page.goto('/host')

    await page.getByRole('radio', { name: /React to the caption/ }).click()
    await page.getByRole('button', { name: 'Decrease Number of rounds' }).click()
    await page.getByRole('button', { name: 'Decrease Number of rounds' }).click()
    await page.getByRole('button', { name: 'Open the room' }).click()

    await expect(page.getByText('React to the caption · 3 rounds · 90s · rank top 3')).toBeVisible()
  })

  test('drops the caption format when there are no captions to format', async ({ page }) => {
    await page.goto('/host')
    await expect(page.getByText('Caption format')).toBeVisible()

    // A value, not a fork: react mode has nobody writing a caption, so the row
    // is not a disabled control — it is absent.
    await page.getByRole('radio', { name: /React to the caption/ }).click()
    await expect(page.getByText('Caption format')).toHaveCount(0)
  })

  test('says why uploads are off rather than hiding them', async ({ page }) => {
    await page.goto('/host')

    await expect(page.getByText('Allow custom image uploads')).toBeVisible()
    await expect(page.getByText('Uploads need somewhere to live. Not in this version.')).toBeVisible()
  })

  test('names the host in their own room', async ({ page }) => {
    await page.goto('/host')
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Jesska')
    await page.getByRole('button', { name: 'Open the room' }).click()

    await expect(page.getByRole('listitem').filter({ hasText: 'Jesska' })).toBeVisible()
  })

  /**
   * The screen's own layout, which is a claim about reach rather than looks.
   *
   * Both projects run this file, and the split turns on at `xl` (1280px) — so
   * desktop at 1440 sees two columns and the phone sees one. The tests below
   * branch on the viewport rather than skipping, because "no wall on a phone"
   * is as much the requirement as "a wall on a desktop".
   */
  test('keeps the CTA in reach without scrolling', async ({ page }) => {
    await page.goto('/host')

    // Not `toBeVisible` — that is true of anything below the fold. This is the
    // assertion that the dock does its job: the button is on screen before
    // anybody scrolls past two Steppers to find it.
    await expect(page.getByRole('button', { name: 'Open the room' })).toBeInViewport()
  })

  test('shows the wall beside the form on a desktop, and not on a phone', async ({ page }) => {
    await page.goto('/host')

    const wall = page.locator('[data-testid="hero-wall"]')
    const split = (page.viewportSize()?.width ?? 0) >= 1280

    if (split) {
      await expect(wall).toBeVisible()
      // It is the larger half. Anything less and it reads as a margin.
      const wallBox = await wall.boundingBox()
      const card = await page.getByRole('textbox', { name: 'Nickname' }).boundingBox()
      expect(wallBox).not.toBeNull()
      expect(card).not.toBeNull()
      // The form is entirely to the left of where the wall's column begins.
      expect(card?.x ?? 0).toBeLessThan((page.viewportSize()?.width ?? 0) * 0.4)
    } else {
      await expect(wall).toBeHidden()
    }
  })

  test('lines the shuffle button up with the field under it', async ({ page }) => {
    await page.goto('/host')

    const shuffle = await page.getByRole('button', { name: 'Shuffle faces' }).boundingBox()
    // The field's own box, not the `<input>` inside it — the input sits within
    // the field's horizontal padding, so its edge is not the one you see.
    const field = await page
      .getByRole('textbox', { name: 'Nickname' })
      .locator('xpath=..')
      .boundingBox()
    expect(shuffle).not.toBeNull()
    expect(field).not.toBeNull()

    // The bug this replaced: the button's pill padding inset its own right
    // edge 34px from the column, so the two controls did not share an edge.
    const shuffleRight = (shuffle?.x ?? 0) + (shuffle?.width ?? 0)
    const fieldRight = (field?.x ?? 0) + (field?.width ?? 0)
    expect(Math.abs(shuffleRight - fieldRight)).toBeLessThanOrEqual(2)
  })
})
