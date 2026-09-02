import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * A contact sheet of every room screen, for a human to look at.
 *
 * Not an assertion suite — `responsive.spec.ts` already measures these widths
 * and every phase has its own spec. This one exists to *produce the pictures*:
 * both modes, both seats, every phase, at whichever viewport the project runs.
 *
 * Off by default. It writes ~40 files per project and has nothing to say about
 * correctness, so it would only slow the gate down. `SHOTS=1` turns it on.
 */
const OUT = path.join(process.cwd(), 'design-review')

test.describe('design review contact sheet', () => {
  test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture the contact sheet')

  // Eighty-odd navigations against a cold dev server, which compiles each
  // route on first request.
  test.setTimeout(600_000)

  /** Every phase with a screen. `opener` is an interstitial over nothing. */
  const PHASES: ReadonlyArray<{ slug: string; phase: string; extra?: string }> = [
    { slug: '01-lobby', phase: 'lobby' },
    { slug: '02-brief', phase: 'brief' },
    { slug: '03-compose', phase: 'compose' },
    { slug: '04-waiting', phase: 'waiting' },
    // The only wait that still offers the host a button — everyone else's
    // fixture submits the whole room, so the tracker reads N of N.
    { slug: '05-waiting-straggler', phase: 'waiting', extra: '&out=1' },
    { slug: '06-vote', phase: 'vote' },
    { slug: '07-tiebreak', phase: 'tiebreak' },
    { slug: '08-reveal', phase: 'reveal' },
    { slug: '09-score', phase: 'score' },
    { slug: '10-podium', phase: 'podium' },
  ]

  const MODES = ['caption', 'react'] as const

  /** The host is `players[0]`, so the default seat always holds the role. */
  const SEATS = [
    { role: 'host', query: '' },
    { role: 'guest', query: '&as=p2' },
  ] as const

  /**
   * Hold everything still before the shutter.
   *
   * Transitions and the static's flicker both land mid-capture otherwise, and
   * a caret blinking in a composer reads as a rendering artefact in a review.
   *
   * `nextjs-portal` is the dev-tools indicator. It only exists under `next dev`
   * — which is the only place this sweep can run, since the URL levers are
   * gated to non-production — so every frame would otherwise carry a badge that
   * ships to nobody.
   */
  async function settle(page: Page): Promise<void> {
    await page.addStyleTag({
      content: `nextjs-portal { display: none !important; }
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }`,
    })
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((done) => {
                img.addEventListener('load', done, { once: true })
                img.addEventListener('error', done, { once: true })
              }),
        ),
      )
      await document.fonts.ready
    })
    await page.waitForTimeout(300)
  }

  /**
   * Two frames, because neither one alone is honest.
   *
   * The viewport frame is what a player actually sees, with the floating keys
   * and the docked rail where they really sit. The full-page frame is the whole
   * document, and Chromium stitches it — which leaves `position: fixed` chrome
   * painted somewhere in the middle of the scroll, looking exactly like a
   * layout bug. So the full page is only kept when there is something below the
   * fold to keep, and it is never the frame a review judges the chrome by.
   */
  async function shoot(page: Page, dir: string, stem: string): Promise<void> {
    await page.screenshot({ path: path.join(dir, `${stem}.png`) })

    const scrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 4,
    )
    if (scrolls) {
      await page.screenshot({ path: path.join(dir, `${stem}-full.png`), fullPage: true })
    }
  }

  test('captures every room screen in both modes, from both seats', async ({
    page,
  }, testInfo) => {
    const viewport = testInfo.project.name

    for (const mode of MODES) {
      const dir = path.join(OUT, mode)
      await mkdir(dir, { recursive: true })

      for (const { slug, phase, extra } of PHASES) {
        for (const { role, query } of SEATS) {
          const url = `/room/DEV?seed=42&gifs=stub&mode=${mode}&phase=${phase}${extra ?? ''}${query}`
          await page.goto(url)
          await expect(page.locator('main[data-phase]')).toBeVisible()
          await settle(page)

          await shoot(page, dir, `${slug}-${role}-${viewport}`)
        }
      }
    }
  })

  /**
   * The three static routes in front of a room.
   *
   * A guest meets `/join` before any of the above, and a host meets `/host`, so
   * a review of "everything before production" that stopped at the room would
   * skip both front doors.
   */
  test('captures the front door', async ({ page }, testInfo) => {
    const viewport = testInfo.project.name
    const dir = path.join(OUT, 'front-door')
    await mkdir(dir, { recursive: true })

    const ROUTES: ReadonlyArray<readonly [string, string]> = [
      ['01-landing', '/?gifs=stub'],
      ['02-host', '/host'],
      ['03-join', '/join'],
    ]

    for (const [slug, url] of ROUTES) {
      await page.goto(url)
      await expect(page.locator('main')).toBeVisible()
      await settle(page)
      await shoot(page, dir, `${slug}-${viewport}`)
    }
  })
})
