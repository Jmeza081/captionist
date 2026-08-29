import { expect, test } from '@playwright/test'

// Selector policy: getByRole > data-testid > CSS. Never target hashed
// `.module.scss` class names — they change on every build.

const NOWHERE = '/a-url-this-app-has-never-had'

test.describe('the 404 page', () => {
  test('answers an unmatched URL with 404 and the app’s own page', async ({ page }) => {
    const response = await page.goto(NOWHERE)

    // The status matters as much as the markup: a pretty page served as 200
    // tells a crawler this URL exists.
    expect(response?.status()).toBe(404)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Nobody could caption this page.',
    )
    await expect(page.getByText('Error 404')).toBeVisible()
    await expect(page.getByText(/We put this URL up for three rounds/)).toBeVisible()
  })

  test('offers both ways out, and both of them work', async ({ page }) => {
    await page.goto(NOWHERE)

    // Links rather than buttons: each is a navigation, so it previews on
    // hover, opens in a new tab, and works before hydration.
    await expect(page.getByRole('link', { name: 'Take me home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Start a game instead' })).toBeVisible()

    await page.getByRole('link', { name: 'Start a game instead' }).click()
    await expect(page).toHaveURL(/\/host$/)

    await page.goto(NOWHERE)
    await page.getByRole('link', { name: 'Take me home' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Caption this.')
  })

  test('shows the round nobody won, art and tallies included', async ({ page }) => {
    await page.goto(NOWHERE)

    // `GIFS_STUB=1` is set for the whole suite, so the card is on the offline
    // shelf — which is the point. The browser resolves no host but the dev
    // server, so a live Giphy URL here would be a broken frame nothing caught.
    const art = page.getByRole('img', { name: /prod is down/i })
    await expect(art).toBeVisible()
    await expect(art).toHaveAttribute('src', '/media/stub-prod.svg')

    await expect(page.getByText('The page you asked for')).toBeVisible()

    // The tallies name their reactions for a screen reader rather than
    // leaving two bare numbers on an image.
    await expect(page.getByText('Skull, 7 reactions')).toBeAttached()
    await expect(page.getByText('Melting, 4 reactions')).toBeAttached()

    await expect(page.getByText(/still the funniest thing on this page/)).toBeVisible()
  })

  test('is reachable by keyboard, wordmark first', async ({ page }) => {
    await page.goto(NOWHERE)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Captionist, home' })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Take me home' })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Start a game instead' })).toBeFocused()
  })

  test('catches a room code that was never a room', async ({ page }) => {
    // Not just unmatched URLs: `/room/[code]` rejects a malformed code with
    // `notFound()`, and this is where that lands.
    //
    // No status assertion here, unlike the routing-level case above: Next
    // answers a *streamed* response 200 and puts the 404 in the body, because
    // the headers are long gone by the time the segment throws.
    await page.goto('/room/not-a-code')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Nobody could caption this page.',
    )
  })
})
