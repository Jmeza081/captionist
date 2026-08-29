import { expect, test } from '@playwright/test'

// The type scale is fluid by construction, not by a guessed `vw` slope. Two
// properties are worth pinning down, because both were broken and neither
// fails loudly — the page just renders, slightly wrong, forever.
//
//  1. The curve is live on a phone. `clamp(38px, 7.2vw, 98px)` reaches its
//     floor at 38 ÷ .072 = 528px, so it was a hard-coded 38px on every phone
//     ever made. A regression here looks like "the scaling stopped working"
//     only if you happen to compare two phone widths side by side.
//  2. Leading tightens as size grows. The spec gives display leading as a
//     range (.94–1.06) precisely so a 48px phone headline isn't set with a
//     98px desktop headline's leading, which collides descenders into caps.

const HEADLINE = 'h1'

async function typeAt(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  return page.locator(HEADLINE).evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      size: parseFloat(s.fontSize),
      leading: parseFloat(s.lineHeight),
    }
  })
}

test.describe('fluid typography', () => {
  test('the display size grows across the phone range', async ({ page }) => {
    const narrow = await typeAt(page, 360)
    const wide = await typeAt(page, 430)

    // 48px is the hero ramp's own floor in the prototype, now reached at the
    // 360px anchor — so a wider phone must be strictly larger. Before the fix
    // both of these were 38px, the floor of a *different* display ramp that
    // DESIGNSYSTEM.md's summary table had merged into this one.
    expect(narrow.size).toBeCloseTo(48, 0)
    expect(wide.size).toBeGreaterThan(narrow.size)
  })

  test('the display size reaches its ceiling at the desktop anchor', async ({
    page,
  }) => {
    const desktop = await typeAt(page, 1440)

    // The screen-share width. Unchanged by the mobile-floor work, and that is
    // the point — the desktop end of the ramp is what the design specifies.
    expect(desktop.size).toBeCloseTo(98, 0)
  })

  test('the hero lines never collide, at any width', async ({ page }) => {
    // The invariant that matters is optical, not ratio-based. Inter 800 sums a
    // descender and a cap-height to 0.978em, so leading below ~0.98 drives the
    // 'p' of "Caption" into the 'S' of "Ship" — which the shipped 0.94 did, by
    // 3.7px at 98px. Measure the ink, not the line box.
    for (const width of [360, 393, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')

      const gap = await page.locator(HEADLINE).evaluate((el) => {
        const cs = getComputedStyle(el)
        const size = parseFloat(cs.fontSize)
        const leading = parseFloat(cs.lineHeight)
        const ctx = document.createElement('canvas').getContext('2d')!
        ctx.font = `800 ${size}px Inter`
        const descender = ctx.measureText('Caption this.').actualBoundingBoxDescent
        const cap = ctx.measureText('Ship that.').actualBoundingBoxAscent
        return leading - descender - cap
      })

      expect(gap, `ink gap at ${width}px`).toBeGreaterThan(4)
    }
  })

  test('display leading still tightens as the headline grows', async ({ page }) => {
    const phone = await typeAt(page, 360)
    const desktop = await typeAt(page, 1440)

    // Holding the optical gap even does not mean holding the ratio even —
    // leading is still inversely proportional to size, 1.12 down to 1.04.
    expect(phone.leading / phone.size).toBeCloseTo(1.12, 2)
    expect(desktop.leading / desktop.size).toBeCloseTo(1.04, 2)
    expect(phone.leading / phone.size).toBeGreaterThan(desktop.leading / desktop.size)
  })

  test('type responds to the reader default font size', async ({ browser }) => {
    // WCAG SC 1.4.4, technique F94: a bare `vw` preferred value cannot be
    // resized by a text-size preference. The `rem` term is what makes this
    // pass — with `clamp(38px, 7.2vw, 98px)` the two measurements were equal.
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } })
    const page = await ctx.newPage()

    await page.goto('/')
    const base = await page
      .locator(HEADLINE)
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))

    // Emulate a reader who has raised their default from 16px to 24px.
    await page.addStyleTag({ content: 'html { font-size: 24px }' })
    const enlarged = await page
      .locator(HEADLINE)
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))

    expect(enlarged).toBeGreaterThan(base)
    await ctx.close()
  })
})
