import { expect, test } from '@playwright/test'

// The layout primitives read spacing through CSS custom properties that Sass
// emits (theme/_css-vars.scss → app/tokens.scss). That indirection is what
// keeps one copy of every value, so it's worth a test: if the bridge breaks,
// every gap silently falls back to 0 and nothing else fails.

test.describe('design tokens', () => {
  test('the spacing scale reaches the browser as custom properties', async ({
    page,
  }) => {
    await page.goto('/')

    const scale = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      const read = (name: string) => root.getPropertyValue(name).trim()
      return {
        space0: read('--space-0'),
        space12: read('--space-12'),
        space26: read('--space-26'),
        space52: read('--space-52'),
        radiusCard: read('--radius-card'),
        radiusPill: read('--radius-pill'),
      }
    })

    // Values are verbatim from DESIGNSYSTEM.md — not rounded to a 4px grid.
    expect(scale.space0).toBe('0')
    expect(scale.space12).toBe('12px')
    expect(scale.space26).toBe('26px')
    expect(scale.space52).toBe('52px')
    expect(scale.radiusCard).toBe('16px')
    expect(scale.radiusPill).toBe('143px')
  })

  test('a Stack resolves its gap prop to a real computed gap', async ({
    page,
  }) => {
    // `JoinPanel` is on the gallery's Molecules tab, which mounts on its own.
    await page.goto('/components#entry')

    // JoinPanel renders <Stack gap={26}> as its root.
    const gap = await page
      .getByRole('region', { name: 'Scan to join' })
      .evaluate((el) => getComputedStyle(el).rowGap)

    expect(gap).toBe('26px')
  })

  test('the page paints the canvas surface, not the old charcoal', async ({
    page,
  }) => {
    await page.goto('/')

    const background = await page
      .locator('body')
      .evaluate((el) => getComputedStyle(el).backgroundColor)

    // #0A0A0B — the app canvas.
    expect(background).toBe('rgb(10, 10, 11)')
  })
})
