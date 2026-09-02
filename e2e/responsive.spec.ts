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

/**
 * The header, at the width the design never drew it.
 *
 * `AppHeader` is specified at 1440×900 only. At 393 the joined phase label
 * clipped mid-word on eight of the thirty-two host/guest × mode × phase
 * headers — "Round 1 of 5 · Wr…" — and on the scoreboard the round pips
 * squeezed the wordmark to 9px, leaving a 26px mark drawn on top of the text.
 *
 * Runs on both projects deliberately, unlike the sweep above: the failure is a
 * phone failure and the fix is a `md` breakpoint, so the desktop pass is what
 * proves the step comes back rather than being dropped everywhere.
 */
test.describe('the room header holds its line', () => {
  test.setTimeout(180_000)

  const PHASES = ['brief', 'compose', 'waiting', 'vote', 'tiebreak', 'reveal', 'score', 'podium']

  test('never truncates its text and never overdraws its own mark', async ({ page }) => {
    for (const mode of ['caption', 'react']) {
      for (const [seat, query] of [
        ['host', ''],
        ['guest', '&as=p2'],
      ] as const) {
        for (const phase of PHASES) {
          const where = `${mode} ${seat} ${phase}`
          await page.goto(`/room/DEV?seed=42&gifs=stub&mode=${mode}&phase=${phase}${query}`)
          await expect(page.locator('main[data-phase]')).toBeVisible()

          const header = await page.evaluate(() => {
            const bar = document.querySelector('header')
            if (!bar) return null
            const visible = Array.from(bar.querySelectorAll('span')).filter(
              (s) => s.getBoundingClientRect().width > 0,
            )
            const mark = bar.querySelector('img')
            const label = visible.find((s) => (s.textContent ?? '').startsWith('Round'))
            return {
              clipped: visible
                .filter((s) => s.scrollWidth > s.clientWidth + 1)
                .map((s) => s.textContent ?? ''),
              // The mark's right edge against the first thing laid out after it.
              markRight: mark ? mark.getBoundingClientRect().right : null,
              labelLeft: label ? label.getBoundingClientRect().left : null,
            }
          })

          expect(header, `${where}: no header`).not.toBeNull()
          expect(header?.clipped ?? [], `${where}: header text is cut off`).toEqual([])

          if (header?.markRight != null && header.labelLeft != null) {
            expect(
              header.labelLeft,
              `${where}: the phase label starts underneath the wordmark`,
            ).toBeGreaterThanOrEqual(header.markRight)
          }
        }
      }
    }
  })
})

/**
 * The floating keys own a band, and the column reserves it.
 *
 * The content column used to dodge them sideways: `$screen-pad-h` on the left,
 * the keys' 64px column on the right. On a 393px phone that spent a quarter of
 * the screen on margin and was visibly lopsided in every frame. The column is
 * even now, and what it reserves instead is the height of the band the keys sit
 * in — so a screen scrolled to its end has nothing hiding underneath them.
 *
 * Mid-scroll they float over content, which is what a floating key is for. The
 * claim here is only about where the content comes to rest.
 */
test.describe('the floating keys never cover the end of a screen', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= 768,
    'above md chat docks into the rail and only the toolbox pill floats',
  )
  test.setTimeout(180_000)

  const PHASES = ['lobby', 'brief', 'compose', 'waiting', 'vote', 'tiebreak', 'reveal', 'score', 'podium']

  test('nothing sits under them once a screen is scrolled to its end', async ({ page }) => {
    for (const mode of ['caption', 'react']) {
      for (const [seat, query] of [
        ['host', ''],
        ['guest', '&as=p2'],
      ] as const) {
        for (const phase of PHASES) {
          await page.goto(`/room/DEV?seed=42&gifs=stub&mode=${mode}&phase=${phase}${query}`)
          await expect(page.locator('main[data-phase]')).toBeVisible()
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

          const covered = await page.evaluate(() => {
            const keys = Array.from(document.querySelectorAll('button, aside')).filter((el) => {
              const cs = getComputedStyle(el)
              return cs.position === 'fixed' && el.getBoundingClientRect().width <= 60
            })
            const boxes = keys.map((k) => k.getBoundingClientRect())
            const hits: string[] = []
            document.querySelectorAll('main *').forEach((el) => {
              if (el.children.length > 0) return
              const text = (el.textContent ?? '').trim()
              if (!text) return
              const r = el.getBoundingClientRect()
              const clash = boxes.some(
                (b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top,
              )
              if (clash) hits.push(text.slice(0, 24))
            })
            return [...new Set(hits)]
          })

          expect(covered, `${mode} ${seat} ${phase}: content under the floating keys`).toEqual([])
        }
      }
    }
  })
})

/**
 * A foot is at the foot, and a board of pictures is scannable.
 *
 * Both of these shipped wrong and neither had a test. The vote screen's lock
 * button was offset by the floating keys' clearance, which sticks a bar that
 * far *above* the fold — it drew in the middle of the board with cards either
 * side of it. And the GIF board asked for 240px columns inside a 313px phone
 * column, so it could only ever fit one tile per row, which is not a wall
 * anyone can scan.
 */
test.describe('the boards and their feet', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= 768,
    'both claims are about the phone layout',
  )

  /** How far above the bottom of the viewport a resting dock may sit. */
  const FOOT_SLACK = 40

  for (const [name, url] of [
    ['the picker', '/room/DEV?seed=42&gifs=stub&phase=brief'],
    ['the vote', '/room/DEV?seed=42&gifs=stub&phase=vote&as=p2'],
  ] as const) {
    test(`${name} rests its action at the foot of the screen`, async ({ page }) => {
      await page.goto(url)
      await expect(page.locator('main[data-phase]')).toBeVisible()
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

      const rest = await page.evaluate(() => {
        const dock = document.querySelector('[class*=actionDock], [class*=lockDock]')
        if (!dock) return null
        const r = dock.getBoundingClientRect()
        return { gap: innerHeight - r.bottom, sticky: getComputedStyle(dock).position }
      })

      expect(rest, `${name}: no dock`).not.toBeNull()
      expect(rest?.sticky).toBe('sticky')
      expect(
        rest?.gap ?? Infinity,
        `${name}: the dock rests ${Math.round(rest?.gap ?? 0)}px above the bottom`,
      ).toBeLessThanOrEqual(FOOT_SLACK)
    })
  }

  test('the picker keeps two tiles to a row', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&gifs=stub&phase=brief')
    await expect(page.locator('main[data-phase]')).toBeVisible()

    const perRow = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('main button')).filter((b) =>
        b.querySelector('img'),
      )
      if (tiles.length < 2) return 0
      // How many share the topmost row — a multicol board lays tiles out in
      // columns, so "a row" is every tile whose top matches the first one's.
      const top = Math.round(tiles[0]!.getBoundingClientRect().top)
      return tiles.filter((t) => Math.abs(Math.round(t.getBoundingClientRect().top) - top) < 4)
        .length
    })

    expect(perRow, 'the board fell back to one tile per row').toBeGreaterThanOrEqual(2)
  })

  test('the search field has the row to itself', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&gifs=stub&phase=brief')
    await expect(page.locator('main[data-phase]')).toBeVisible()

    // Squeezed into a row beside two buttons, the input collapsed to its
    // magnifier and the placeholder was unreadable.
    const width = await page.evaluate(() => {
      const input = document.querySelector('main input')
      return input ? input.getBoundingClientRect().width : 0
    })
    expect(width, 'the search field is sharing its row again').toBeGreaterThan(200)
  })
})
