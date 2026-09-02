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

/**
 * Every control a finger can land on, minus two kinds that are not competing
 * for one.
 *
 * The Next dev-tools badge floats over the page and is not shipped.
 *
 * **Empty** `aria-hidden` buttons are excluded because of what they are: a
 * pointer affordance laid over content that already has a labelled control
 * elsewhere — `MediaCard`'s `onActivate`, which makes the picture a second way
 * to rank the card. It is out of the tab order and out of the accessibility
 * tree precisely so it is not a second control, it is exactly the size of the
 * thing it sits on, and it is what a sticky bar over a scrolling grid is
 * *supposed* to cover. Counting it here would report the vote screen's lock
 * dock resting on the card behind it as a stolen tap, which is layering
 * working. The size of one is pinned separately below, so it cannot quietly
 * grow past its picture.
 *
 * `:empty` is what keeps that exclusion to backdrops. A hidden button that
 * *draws* something is a control with an accessibility problem, not a
 * backdrop, and it stays in the sweep where a future one would otherwise drop
 * out of it in silence.
 */
const SHIPPED =
  'button:not([data-nextjs-dev-tools-button]):not([aria-hidden="true"]:empty), a[href]'

interface Hit {
  x: number
  y: number
  w: number
  h: number
  /** Inside a sticky action dock — the one thing allowed over the page. */
  dock: boolean
  /** Floats over the page rather than scrolling with it. */
  fixed: boolean
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
          // Whether this control belongs to a sticky action dock, and whether
          // it floats over the page rather than scrolling with it. The clash
          // rule below needs both.
          dock: Boolean(el.closest('[class*="ockDock"], [class*="ctionDock"]')),
          fixed: getComputedStyle(el).position === 'fixed',
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
          /**
           * A sticky dock is *meant* to be over the grid it floats on.
           *
           * Its ground is `pointer-events: none` and only the control itself
           * takes a tap, so a card underneath stays reachable through the fade
           * — which is also why these pairs started showing up here at all:
           * `elementFromPoint` cannot see a click-through overlay, so the
           * controls beneath one stopped reading as occluded.
           *
           * What the rule is actually for is a control that has silently ended
           * up under something it cannot be seen through — the floating keys.
           * Those are `position: fixed` and never a dock, so every pair that
           * matters is still compared: dock against key, key against anything.
           */
          const dockOverPage = (x: typeof a, y: typeof a) => x.dock && !y.dock && !y.fixed
          if (dockOverPage(a, b) || dockOverPage(b, a)) continue

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

  test('the picture’s tap target is the picture, and nothing more', async ({ page }) => {
    await page.goto('/room/C-F34911?seed=42&phase=vote&as=p2&gifs=stub')
    await expect(page.locator('main[data-phase]')).toBeVisible()

    // It is left out of the overlap sweep above because it is a backdrop
    // rather than a control, so this is what holds it to that: exactly its
    // frame, never a pixel outside it, where it could take a neighbour's tap.
    const boxes = await page.$$eval('button[aria-hidden="true"]:empty', (els) =>
      els.map((el) => {
        const hit = el.getBoundingClientRect()
        const frame = el.parentElement!.getBoundingClientRect()
        return {
          dx: Math.abs(hit.x - frame.x) + Math.abs(hit.right - frame.right),
          dy: Math.abs(hit.y - frame.y) + Math.abs(hit.bottom - frame.bottom),
        }
      }),
    )
    expect(boxes.length).toBeGreaterThan(0)
    for (const box of boxes) {
      expect(box.dx).toBeLessThanOrEqual(1)
      expect(box.dy).toBeLessThanOrEqual(1)
    }
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
