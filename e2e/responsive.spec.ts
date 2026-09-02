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
 * The control that ends the phase is never under the floating keys.
 *
 * There are three things to want from that corner and only two can be true at
 * once: even gutters, controls that run the full width, and nothing tappable
 * ever underneath the keys. The column used to buy the third by reserving a
 * whole key's width on both sides — 52px of gutter each side of a 393px phone,
 * a quarter of the screen, paid by every card, caption and board tile on it.
 *
 * The gutter is `$space-20` now — the same one the front doors use — and the
 * corner is cleared vertically instead, which narrows the claim to the half
 * that matters. A screen's committing control
 * lives in a sticky bar that declares itself with `data-action-dock`, and the
 * room lifts the whole key column above that bar (`--room-dock-base`). So the
 * fault this suite was written for — "the right end of Lock my ranking opened
 * chat" — cannot come back.
 *
 * What is no longer claimed: that an *ordinary* control never passes under a
 * key. A board tile, a card's "Rank this" and the duel's "Vote this one" can,
 * mid-scroll, exactly as page content passes under a floating action button in
 * any app — and a nudge of the page frees them. `targets.spec.ts` still holds
 * the stronger line where it can be held: nothing overlaps at the position each
 * screen actually paints at.
 */
/**
 * A sticky foot is at the foot — at every scroll position, and at both sizes.
 *
 * This shipped broken on the desktop half and no test could see it. `.lockDock`
 * unpinned itself past `$vote-bar-columns`, on the reasoning that a wide layout
 * has no need of a sticky foot; above `md` the room is an app shell, so a
 * static bar at the end of a four-card grid sat 164px below the fold and crept
 * up the screen as the board scrolled. Then, pinned again, it rested 78px high:
 * above `md` the *column* is the scroller, and a scroller's own bottom padding
 * pushes a `bottom: 0` sticky child up by exactly that much.
 *
 * Both faults are about where the control ends up, so that is what this
 * measures — the gap between the control and the fold, swept top to bottom.
 * Anything that is not the bar's own `padding-bottom` is a bug.
 */
test.describe('a sticky action bar', () => {
  test.setTimeout(180_000)

  /** The bar's own ground under the control, plus a pixel of rounding. */
  const FOOT_GAP = 16

  const SCREENS: readonly (readonly [string, string])[] = [
    ['brief', '/room/DEV?seed=42&gifs=stub&phase=brief'],
    ['compose (react)', '/room/DEV?seed=42&gifs=stub&mode=react&phase=compose&as=p2'],
    ['vote', '/room/DEV?seed=42&gifs=stub&phase=vote&as=p2'],
    ['vote (react)', '/room/DEV?seed=42&gifs=stub&mode=react&phase=vote&as=p2'],
  ]

  for (const [name, url] of SCREENS) {
    test(`stays at the foot of ${name}`, async ({ page }) => {
      await page.goto(url)
      await expect(page.locator('main[data-phase]')).toBeVisible()
      await expect(page.locator('[data-action-dock] button').first()).toBeVisible()

      // Whichever box actually scrolls: the window on a phone, the content
      // column above `md`, where the shell is an app shell rather than a page.
      const plan = await page.evaluate(() => {
        const main = document.querySelector('main')!
        const inMain = main.scrollHeight > main.clientHeight
        return {
          inMain,
          total: inMain
            ? main.scrollHeight - main.clientHeight
            : document.documentElement.scrollHeight - window.innerHeight,
        }
      })

      const gaps: number[] = []
      for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
        await page.evaluate(
          ({ frac, inMain, total }) => {
            const y = Math.round(total * frac)
            if (inMain) document.querySelector('main')!.scrollTop = y
            else window.scrollTo(0, y)
          },
          { frac, ...plan },
        )
        gaps.push(
          await page.evaluate(() => {
            const b = document.querySelector('[data-action-dock] button')!.getBoundingClientRect()
            return Math.round(window.innerHeight - b.bottom)
          }),
        )
      }

      // Reported as a set, so a failure says which scroll position broke it
      // rather than just the first one that did.
      const off = gaps.filter((gap) => gap < 0 || gap > FOOT_GAP)
      expect(
        off,
        `gaps from the fold at 0/25/50/75/100% scroll were ${gaps.join(', ')}px`,
      ).toEqual([])
    })
  }
})

test.describe('the floating keys', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= 768,
    'above md chat docks into the rail and the toolbox pill sits clear of the column',
  )
  test.setTimeout(240_000)

  const PHASES = ['lobby', 'brief', 'compose', 'waiting', 'vote', 'tiebreak', 'reveal', 'score', 'podium']

  /**
   * How close to the fold still counts as "at the foot".
   *
   * A pinned bar's control sits within the bar's own bottom padding of it. A
   * bar that has scrolled up out of the foot is page content, and this rule is
   * not about it — every bar in the room pins for the whole page, so in
   * practice this only excuses the frames where one is settling.
   */
  const FOOT_PX = 24

  /** Every docked control a key overlapped while the bar was at the foot. */
  async function coveredAtFoot(page: Page): Promise<string[]> {
    const hits = new Set<string>()
    const steps = await page.evaluate(() =>
      Math.ceil(document.body.scrollHeight / (window.innerHeight / 2)),
    )

    for (let i = 0; i <= steps; i++) {
      await page.evaluate((n) => window.scrollTo(0, n * (window.innerHeight / 2)), i)
      const found = await page.evaluate((foot: number) => {
        const keys = Array.from(document.querySelectorAll('button, aside')).filter((el) => {
          const cs = getComputedStyle(el)
          return cs.position === 'fixed' && el.getBoundingClientRect().width <= 60
        })
        const boxes = keys.map((k) => k.getBoundingClientRect())
        const out: string[] = []
        document
          .querySelectorAll('[data-action-dock] button, [data-action-dock] a')
          .forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.bottom < window.innerHeight - foot) return
            const clash = boxes.some(
              (b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top,
            )
            if (clash) out.push((el.textContent ?? '').trim().slice(0, 24) || el.tagName)
          })
        return out
      }, FOOT_PX)
      found.forEach((f) => hits.add(f))
    }
    return [...hits]
  }

  for (const mode of ['caption', 'react'] as const) {
    test(`${mode} mode keeps the phase's own control clear of them`, async ({ page }) => {
      for (const [seat, query] of [
        ['host', ''],
        ['guest', '&as=p2'],
      ] as const) {
        for (const phase of PHASES) {
          await page.goto(`/room/DEV?seed=42&gifs=stub&mode=${mode}&phase=${phase}${query}`)
          await expect(page.locator('main[data-phase]')).toBeVisible()
          expect(
            await coveredAtFoot(page),
            `${mode} ${seat} ${phase}: the sticky action bar passes under the floating keys`,
          ).toEqual([])
        }
      }
    })
  }
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
