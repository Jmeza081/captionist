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

/**
 * The real hit area: the border box, or the `::after` that grew it.
 *
 * Controls that are **completely behind painted ground** are left out, and
 * that exclusion is load-bearing rather than a loophole. The vote screen's
 * lock dock is `position: sticky; bottom: 0` with a real background — not a
 * fade, deliberately, so caption text is not legible through it — and a phone
 * voter therefore always has *some* card's foot row buried under it. That is
 * how a sticky bar over a scrolling grid works, and the buried row is not
 * offered to anybody: you scroll, and it appears.
 *
 * What this file exists to catch is the other thing — two controls the viewer
 * can *see*, one silently taking the other's tap. So a control is dropped only
 * when every sample point *that is on the screen* resolves to a painted
 * element which is neither it nor an ancestor of it. The bug in the comment
 * below survives that filter: the lock button's own centre resolved to the
 * lock button, and only its right end was under the chat key.
 *
 * "On the screen" is load-bearing, and was not always: a control straddling
 * the fold has sample points below the viewport, `elementFromPoint` answers
 * `null` for those, and counting `null` as "nothing is painted here" made a
 * foot row that was half under the dock and half below the fold read as fully
 * visible.
 */
async function hits(page: Page, selector: string): Promise<Hit[]> {
  return page.$$eval(selector, (els) =>
    els
      .filter((el) => !el.closest('nextjs-portal'))
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return true
        const inset = 1
        const points: Array<[number, number]> = [
          [r.x + r.width / 2, r.y + r.height / 2],
          [r.x + inset, r.y + inset],
          [r.right - inset, r.y + inset],
          [r.x + inset, r.bottom - inset],
          [r.right - inset, r.bottom - inset],
        ]
        return points.some(([x, y]) => {
          // Off-screen is not evidence of anything. `elementFromPoint` answers
          // `null` both for "nothing is painted here" and for "that is not on
          // the screen", and reading the second as the first is how a control
          // sitting on the fold — most of it below the viewport, the rest
          // under the sticky dock — counted as visible and then clashed with
          // the dock it was hidden behind.
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false
          const top = document.elementFromPoint(x, y)
          if (!top) return true
          if (top === el || el.contains(top) || top.contains(el)) return true
          // Something else is on top. It only occludes if it actually paints.
          const style = getComputedStyle(top)
          const painted =
            style.backgroundImage !== 'none' ||
            !/^rgba\(.*,\s*0\)$/.test(style.backgroundColor)
          return !painted
        })
      })
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
