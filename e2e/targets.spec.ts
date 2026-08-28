import { expect, test, type Page } from '@playwright/test'

/**
 * The touch-target floor, measured rather than asserted in prose.
 *
 * DESIGNSYSTEM.md draws several controls below 44px on purpose — a reaction CTA
 * is a 28–34px pill, a picker tile 36–42px — and the design is the authority on
 * how big a thing *looks*. `theme`'s `tapTarget` mixin separates the two: the
 * control keeps its drawn size and a centred pseudo-element gives the finger
 * its 44px.
 *
 * That trick has one failure mode, and it is worse than the problem: two grown
 * areas that overlap silently steal each other's taps. So the load-bearing test
 * here is the overlap one, not the size one.
 */

/** The Next dev-tools badge floats over the page and is not shipped. */
const SHIPPED = 'button:not([data-nextjs-dev-tools-button]), a[href]'

interface Hit {
  x: number
  y: number
  w: number
  h: number
  label: string
}

/** The real hit area: the border box, or the `::after` that grew it. */
async function hits(page: Page, selector: string): Promise<Hit[]> {
  return page.$$eval(selector, (els) =>
    els
      .filter((el) => !el.closest('nextjs-portal'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        const after = getComputedStyle(el, '::after')
        const w = Math.max(r.width, parseFloat(after.width) || 0)
        const h = Math.max(r.height, parseFloat(after.height) || 0)
        return {
          x: r.x + r.width / 2 - w / 2,
          y: r.y + r.height / 2 - h / 2,
          w,
          h,
          label:
            el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 30) || el.tagName,
        }
      })
      .filter((b) => b.w > 0 && b.h > 0),
  )
}

const SCREENS: readonly (readonly [string, string])[] = [
  ['vote', '/room/C-F34911?seed=42&phase=vote&as=p2&gifs=stub'],
  ['reveal', '/room/C-F34912?seed=42&phase=reveal&as=p2&gifs=stub'],
  ['lobby', '/room/C-F34913?seed=42&gifs=stub'],
]

test.describe('touch targets', () => {
  test('no two of them overlap, so none can steal another’s tap', async ({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, 'the floating dock is the phone layout')

    const clashes: string[] = []
    for (const [name, url] of SCREENS) {
      await page.goto(url)
      await expect(page.locator('main[data-phase]')).toBeVisible()

      const boxes = await hits(page, SHIPPED)
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!
          const b = boxes[j]!
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
          // A pixel of rounding is not an overlap.
          if (ox > 1 && oy > 1) clashes.push(`${name}: "${a.label}" over "${b.label}"`)
        }
      }
    }

    // The one this caught: the vote screen's full-width lock button ran under
    // the floating chat key, so the right end of "Lock my ranking" opened chat.
    expect(clashes, clashes.join('\n')).toEqual([])
  })

  test('the vote card’s own keys clear 44px', async ({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, 'phone is where the finger is')
    await page.goto('/room/C-F34914?seed=42&phase=vote&as=p2&gifs=stub')
    await expect(page.locator('main[data-phase]')).toBeVisible()

    for (const box of await hits(page, 'figcaption button')) {
      expect(box.w, `${box.label} is ${box.w}px wide`).toBeGreaterThanOrEqual(44)
      expect(box.h, `${box.label} is ${box.h}px tall`).toBeGreaterThanOrEqual(44)
    }
  })
})
