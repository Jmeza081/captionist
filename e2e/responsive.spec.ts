import { expect, test, type Page } from '@playwright/test'

/**
 * The widths between a phone and a desktop, which nothing used to cover.
 *
 * Every room screen reflowed at `md` — a viewport query — while the column it
 * reflows *in* is the viewport minus a docked 360px chat rail. So a 768px
 * window laid a two-column screen out in 288px: the caption form rendered
 * under the rail, the reveal's winner card was squeezed to 50px, and three
 * vote cards shared 288px between them. The screens ask their own width now,
 * and this is the sweep that says so.
 *
 * Run once. Both projects would sweep the same widths through the same
 * browser, and the second pass would only prove that `setViewportSize` works.
 */
test.describe('responsiveness across the middle widths', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 768,
    'the sweep sets its own widths — running it twice proves nothing twice',
  )

  // Ninety navigations, sharing one dev server with everything else a fully
  // parallel run is doing. It finishes in about fifteen seconds alone and had
  // been quietly living inside the 45s default; adding the react lane is what
  // pushed it over under load.
  test.setTimeout(240_000)

  /** `md`, the old cliff, `lg`, where the rail arrives open, and either side. */
  const WIDTHS = [393, 768, 860, 1024, 1180, 1440]

  /**
   * Both modes, not just the one.
   *
   * `prompt` was the only react-mode entry here, so the whole answering half of
   * that lane — the GIF board under a prompt banner, the tracker, the vote grid
   * with its own full-width subject line, the reveal's runner-up rows — swept
   * at caption-mode widths and never at its own. Every one of them draws
   * different content in a different shape.
   */
  const SCREENS: ReadonlyArray<readonly [string, string]> = [
    ['lobby', '/room/DEV?seed=42&phase=lobby&gifs=stub'],
    ['brief', '/room/DEV?seed=42&phase=brief&as=p2&gifs=stub'],
    ['prompt', '/room/DEV?seed=42&phase=brief&mode=react&gifs=stub'],
    ['promptwait', '/room/DEV?seed=42&phase=brief&mode=react&as=p2&gifs=stub'],
    ['compose', '/room/DEV?seed=42&phase=compose&as=p2&gifs=stub'],
    ['submit', '/room/DEV?seed=42&phase=compose&mode=react&as=p2&gifs=stub'],
    ['waiting', '/room/DEV?seed=42&phase=waiting&as=p2&gifs=stub'],
    ['waiting-react', '/room/DEV?seed=42&phase=waiting&mode=react&as=p2&gifs=stub'],
    ['vote', '/room/DEV?seed=42&phase=vote&as=p2&gifs=stub'],
    ['vote-react', '/room/DEV?seed=42&phase=vote&mode=react&as=p2&gifs=stub'],
    ['reveal', '/room/DEV?seed=42&phase=reveal&as=p2&gifs=stub'],
    ['reveal-react', '/room/DEV?seed=42&phase=reveal&mode=react&as=p2&gifs=stub'],
    ['score', '/room/DEV?seed=42&phase=score&as=p2&gifs=stub'],
    ['podium', '/room/DEV?seed=42&phase=podium&as=p2&gifs=stub'],
    ['tiebreak', '/room/DEV?seed=42&phase=tiebreak&as=p2&gifs=stub'],
  ]

  /** How far the document scrolls sideways. Anything but zero is a bug. */
  async function overflow(page: Page): Promise<number> {
    return page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth - doc.clientWidth
    })
  }

  /**
   * Both claims off one navigation.
   *
   * They were two tests, which meant fifteen screens loaded at six widths
   * twice — a hundred and eighty page loads sharing a dev server with the rest
   * of a fully parallel run, and the slowest thing in the suite by some margin.
   * Nothing about either check needs its own page load, and each failure still
   * names the screen and the width it happened at.
   */
  test('holds its shape at every width between a phone and a desktop', async ({ page }) => {
    // Narrow enough that a headline breaks badly and a paragraph runs one word
    // to the line. Compose was at 136px before the screens started measuring
    // themselves, which is where this number comes from.
    //
    // A phone is its own floor: 393px minus the screen padding and the corner
    // the floating keys own is 289, and there is nothing to reflow into.
    const floorFor = (width: number) => (width < 768 ? 260 : 300)

    for (const [name, url] of SCREENS) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(url)
        await expect(page.locator('main[data-phase]')).toBeVisible()

        expect(await overflow(page), `${name} at ${width}px scrolls sideways`).toBe(0)

        const narrowest = await page.evaluate(() => {
          let worst: { width: number; text: string } | null = null
          document.querySelectorAll('main p, main h1').forEach((el) => {
            const text = (el.textContent ?? '').trim()
            const box = el.getBoundingClientRect()
            // Only real sentences: a one-word label is allowed to be narrow.
            if (text.length < 40 || box.width === 0) return
            if (!worst || box.width < worst.width) {
              worst = { width: box.width, text: text.slice(0, 40) }
            }
          })
          return worst as { width: number; text: string } | null
        })

        if (narrowest === null) continue
        expect(
          Math.round(narrowest.width),
          `${name} at ${width}px — "${narrowest.text}…"`,
        ).toBeGreaterThanOrEqual(floorFor(width))
      }
    }
  })

  test('drops a vote card rather than shrinking one past reading', async ({ page }) => {
    // `$vote-card-min`. A caption is drawn over the picture, so a cell narrower
    // than this stops being readable rather than just being small.
    const CARD_MIN = 260

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')
      await expect(page.getByRole('button', { name: 'Pick 3 more' })).toBeVisible()

      const cards = await page
        .locator('main figure')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))

      expect(cards.length).toBeGreaterThan(0)
      for (const card of cards) {
        expect(Math.round(card), `vote card at ${width}px`).toBeGreaterThanOrEqual(
          CARD_MIN,
        )
      }
    }
  })

  test('holds the rail back until the room can spare it', async ({ page }) => {
    // Docking is not the same question as arriving open: 360px of rail in a
    // 768px window leaves the round 288px. Between `md` and `lg` chat is one
    // key away instead — see `lib/useWideViewport.ts`.
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')
    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()

    await page.setViewportSize({ width: 1024, height: 900 })
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()
  })
})
