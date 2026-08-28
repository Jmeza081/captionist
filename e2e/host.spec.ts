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
})
