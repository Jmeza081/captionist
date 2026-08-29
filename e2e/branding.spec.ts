import { expect, test } from '@playwright/test'

// The mark is decorative in the DOM — no role, no alt — so nothing else in the
// suite would notice if it stopped loading. It would just go blank, at the top
// of every screen. These check the pixels actually arrive.

test.describe('the Captionist mark', () => {
  test('loads on the front door, at the size the design draws', async ({
    page,
  }) => {
    await page.goto('/')

    const mark = page.locator('header img[src="/logo.svg"]').first()
    await expect(mark).toBeAttached()

    const drawn = await mark.evaluate((el: HTMLImageElement) => ({
      loaded: el.complete && el.naturalWidth > 0,
      width: Math.round(el.getBoundingClientRect().width),
      // The artwork brings its own corners; a second radius would clip the
      // ground away from the bubble's tail.
      radius: getComputedStyle(el).borderTopLeftRadius,
    }))

    expect(drawn.loaded).toBe(true)
    expect(drawn.width).toBe(34) // $landing-mark
    expect(drawn.radius).toBe('0px')
  })

  test('is served at every icon surface a browser asks for', async ({
    request,
  }) => {
    for (const path of ['/favicon.ico', '/icon.svg', '/apple-icon.png']) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      expect((await response.body()).byteLength, path).toBeGreaterThan(0)
    }
  })

  test('points the document at the generated icons', async ({ page }) => {
    await page.goto('/')

    const rels = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(
        (el) => el.getAttribute('href') ?? '',
      ),
    )

    expect(rels.some((href) => href.includes('icon'))).toBe(true)
    expect(rels.some((href) => href.includes('apple-icon'))).toBe(true)
  })
})
