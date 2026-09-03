import { expect, test } from '@playwright/test'

/**
 * Setting the round up, in all four faces.
 *
 * `?gifs=stub` keeps every run off Giphy's rate limit and makes the grid
 * deterministic. `?as=p2` sits in someone else's seat — round one's role
 * holder is always `p0`, so the waiting faces are unreachable otherwise.
 */
test.describe('the brief', () => {
  test('picks a GIF and opens the round', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')

    await expect(page.getByText('You’re up, Jesse')).toBeVisible()

    // The CTA reads the same before and after a pick — the board is what says
    // nothing is chosen yet. It is still blocked, and still focusable.
    const lock = page.getByRole('button', { name: 'Lock it in' })
    await expect(lock).toBeVisible()

    await page.getByRole('textbox', { name: 'Search GIFs' }).fill('prod')
    await page.getByRole('textbox', { name: 'Search GIFs' }).press('Enter')
    // A GIF tile is the only button on the screen wrapping an image; matching
    // by label would catch the suggestion chips, and so would `aria-pressed`.
    const tiles = page.locator('button:has(img)')
    await expect(tiles.first()).toBeVisible()

    await tiles.first().click()
    await expect(page.getByText('Selected', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Lock it in' }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose')
  })

  test('lets you type a search, and keeps both controls beside the field', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&gifs=stub')

    // The field was controlled by the hook with a no-op change handler, so it
    // took a suggestion chip but not a keystroke. Typed, not filled: `fill`
    // sets the value in one event and would have passed against the bug.
    const search = page.getByRole('textbox', { name: 'Search GIFs' })
    await search.pressSequentially('rollback')
    await expect(search).toHaveValue('rollback')

    // Both live with the search — nothing waits at the bottom of a board that
    // scrolls a long way.
    //
    // "Surprise me" and "Shuffle results" are different controls and both are
    // here, side by side under the field. Surprise commits to one of the fifty
    // tiles already loaded, for nothing; Shuffle goes and gets another fifty.
    // ADR-0021 deleted the second to save the call and ADR-0026 put it back.
    await expect(page.getByRole('button', { name: /Surprise me/ })).toBeInViewport()
    await expect(page.getByRole('button', { name: /Shuffle results/ })).toHaveCount(1)

    // And the one control that ends the phase runs the width of the column at
    // its foot, rather than sharing that bar with "Surprise me".
    const lock = page.getByRole('button', { name: 'Lock it in' })
    await expect(lock).toBeInViewport()
    const column = page.locator('main[data-phase]')
    expect((await lock.boundingBox())?.width).toBeGreaterThan(
      ((await column.boundingBox())?.width ?? 0) * 0.6,
    )

    // And the note about the clock reads with the headline, not with the button.
    await expect(
      page.getByText('If the clock runs out we’ll pick for you'),
    ).toBeInViewport()
  })

  test('writes a prompt in the reversed mode, with a live preview', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&mode=react&gifs=stub')

    await expect(page.getByText('You’re the Prompter')).toBeVisible()

    const field = page.getByRole('textbox', { name: 'The prompt' })
    await field.fill('me explaining the outage to leadership')

    // The design's counter, exactly: 38 of 90.
    await expect(page.getByText('38 / 90')).toBeVisible()
    // What the room sees updates as you type, and it is your prompt, not
    // someone else's, so it is not addressed in the third person.
    await expect(page.getByText('Your prompt', { exact: true })).toBeVisible()
    await expect(page.getByText('“me explaining the outage to leadership”')).toBeVisible()

    await page.getByRole('button', { name: 'Send it to the room' }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose')
  })

  test('waits behind a wall of GIFs, under the room glow', async ({ page }) => {
    /**
     * The design's own note on artboard 1h is what this guards: dead time
     * turned into anticipation with a live cycling wall, *"rather than an empty
     * spinner"*. A full-bleed clip used to be veiled behind the words instead,
     * which was the same idea drawn worse — so nothing sits behind the copy now
     * but the room's glow.
     */
    await page.route('**api.klipy.com/**', (route) => {
      // The adapter maps answers back onto the slugs it asked for, so a stub
      // has to echo them — invented ids resolve to an empty wall.
      const asked =
        new URL(route.request().url()).searchParams.get('slugs')?.split(',') ?? []
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: true,
          data: {
            data: asked.map((slug, i) => ({
              slug,
              title: `Art ${i}`,
              type: 'gif',
              tags: [],
              file: {
                md: {
                  gif: { url: `https://static.klipy.com/a${i}.gif`, width: 480, height: 360 },
                  mp4: { url: `https://static.klipy.com/a${i}.mp4`, width: 480, height: 360 },
                },
                xs: {
                  jpg: { url: `https://static.klipy.com/a${i}.jpg`, width: 90, height: 64 },
                },
              },
            })),
            current_page: 1,
            per_page: 50,
            has_next: false,
          },
        }),
      })
    })

    await page.goto('/room/DEV?seed=42&phase=brief&as=p2&gifs=klipy')
    await expect(page.getByText('Jesse is scrolling for a GIF.')).toBeVisible()

    const wall = page.getByRole('img', { name: /wall of looping/ })
    await expect(wall).toBeVisible()
    // Four frames, each holding the four clips it dissolves between.
    await expect(wall.locator('video')).toHaveCount(16)
    // Playback starts off and a client island turns it on — ADR 0005. The
    // clips never load here, so what is checkable is the contract around them.
    await expect(wall.locator('video').first()).not.toHaveAttribute('autoplay', /.*/)
    await expect(wall.locator('video').first()).toHaveAttribute('poster', /\.jpg$/)

    // Somebody else's art, credited once for the wall.
    await expect(page.getByText('GIFs via KLIPY')).toBeVisible()

    // Nothing behind the words any more.
    await expect(page.locator('[data-testid="scene-backdrop"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="scene-backdrop-tuning"]')).toHaveCount(0)
  })

  test('tunes dead channels in the wall when no art resolves', async ({ page }) => {
    // The ordinary offline case, and the one the rest of this suite runs in: no
    // key, no network, no lookup. The wall is the same four frames either way —
    // it is sized in CSS, not by its contents — so nothing on the screen moves
    // when the art does or does not arrive.
    await page.goto('/room/DEV?seed=42&phase=brief&as=p2&gifs=stub')

    await expect(page.getByText('Jesse is scrolling for a GIF.')).toBeVisible()

    const wall = page.getByRole('img', { name: /wall of looping/ })
    await expect(wall).toBeVisible()
    await expect(wall.getByTestId('tv-static')).toHaveCount(4)
    await expect(wall.locator('video')).toHaveCount(0)
    // Ours, not theirs — there is nothing of the provider's on screen to credit.
    await expect(page.getByText(/via KLIPY/)).toHaveCount(0)
  })

  test('keeps the wall to one row that never scrolls, at every width', async ({
    page,
  }) => {
    /**
     * Frames drop off the end as the column narrows and what is left is
     * centred — the wall is a complete picture at every width rather than a
     * cropped one with the rest hidden off the edge. It was a sideways scroller
     * first, which is the thing this guards against coming back.
     *
     * The widths are walked on one page rather than across projects because the
     * measure is the *container*: the docked chat rail takes 360px out of the
     * column that no window query can see, so a wall that looked right at 1440
     * could still spill at 1024.
     */
    await page.goto('/room/DEV?seed=42&phase=brief&as=p2&gifs=stub')
    await expect(page.getByText('Jesse is scrolling for a GIF.')).toBeVisible()

    const wall = page.getByRole('img', { name: /wall of looping/ })

    for (const width of [360, 480, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })

      const shape = await wall.evaluate((el) => {
        const frames = [...el.children].filter((child) =>
          child.hasAttribute('data-frame'),
        )
        const shown = frames.filter((f) => (f as HTMLElement).offsetParent !== null)
        const boxes = shown.map((f) => f.getBoundingClientRect())
        return {
          shown: shown.length,
          scrolls: el.scrollWidth > el.clientWidth + 1,
          // One row: every visible frame shares a top edge.
          tops: new Set(boxes.map((b) => Math.round(b.top))).size,
        }
      })

      expect(shape.scrolls, `wall scrolls at ${width}px`).toBe(false)
      expect(shape.tops, `wall wrapped at ${width}px`).toBeLessThanOrEqual(1)
      expect(shape.shown, `no frames at ${width}px`).toBeGreaterThan(0)
    }

    // And the page itself never gains a sideways scrollbar on the way through.
    const spills = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(spills).toBe(false)
  })

  test('names who takes the role next, and does not promise a round that is left', async ({
    page,
  }) => {
    /**
     * The rotation is `roleHolderIndex` modulo a roster held in join order, so
     * the queue is a schedule rather than the shuffle the artboard's caption
     * claims — and it is capped by the rounds actually remaining, which is the
     * part a five-player room playing its last round would otherwise get wrong.
     */
    await page.goto('/room/DEV?seed=42&phase=brief&as=p2&gifs=stub')

    const queue = page.getByText(/^Up next after/)
    await expect(queue).toHaveText('Up next after Jesse')
    await expect(page.getByText('in the order they joined')).toBeVisible()
    // The claim the design made and the code does not keep.
    await expect(page.getByText(/randomised/)).toHaveCount(0)
  })

  test('turns the wait into something to read', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=brief&as=p2&gifs=stub')

    await expect(page.getByText('Jesse is scrolling for a GIF.')).toBeVisible()
    await expect(page.getByText('Picking')).toBeVisible()
    // Not your deadline, so the clock drops its suffix.
    await expect(page.getByRole('timer')).toHaveText(/^\d:\d\d$/)
  })

  test('still puts an image up when the clock wins', async ({ page }) => {
    // `?as=p2` watches from another seat, so nothing in this tab can pick and
    // the brief clock is what ends the phase. It used to hand the room a
    // subject with no image at all and spoil everyone else's round.
    await page.goto('/room/DEV?seed=42&phase=brief&fast=40&as=p2&gifs=stub')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose', {
      timeout: 20_000,
    })

    // A real image off the offline shelf, drawn with the room's own seed.
    const image = page.locator('main[data-phase] figure img').first()
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('src', /\/media\/stub-/)
    await expect(page.getByText('No image was picked in time')).toHaveCount(0)
  })
})
