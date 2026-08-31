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

    // The CTA is blocked until something is chosen, and says so.
    const lock = page.getByRole('button', { name: 'Pick one first' })
    await expect(lock).toBeVisible()

    await page.getByRole('textbox', { name: 'Search GIFs' }).fill('prod')
    await page.getByRole('textbox', { name: 'Search GIFs' }).press('Enter')
    // A GIF tile is the only button on the screen wrapping an image: matching
    // the label would also catch the blocked "Pick one first" CTA, and
    // `aria-pressed` would catch the suggestion chips.
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

    // Both live with the search now — nothing waits at the bottom of a board
    // that scrolls a long way.
    //
    // The secondary is "Surprise me", not "Shuffle results". Shuffle fetched
    // the next page of twelve; the board holds fifty and that page was a whole
    // API call to show what was already on screen. Surprise reads one off the
    // board it has, for nothing. See ADR-0021.
    await expect(page.getByRole('button', { name: 'Surprise me' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Pick one first' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Shuffle results' })).toHaveCount(0)

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

  test('gives the wait something to look at, without losing the words', async ({
    page,
  }) => {
    /**
     * The backdrop is resolved in the browser now, from a slug.
     *
     * A server may not fetch it and its URL may not be committed, so there is
     * nothing on screen until a client has asked — and this suite resolves every
     * host but the dev server to nothing. Routing the lookup is what keeps the
     * layering contract below checkable at all.
     */
    await page.route('**api.klipy.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: true,
          data: {
            data: [
              {
                slug: 'celebrate-165',
                title: 'Colorful Fireworks Celebrate Night Sky',
                type: 'gif',
                tags: [],
                file: {
                  md: {
                    gif: { url: 'https://static.klipy.com/b.gif', width: 640, height: 360 },
                    mp4: { url: 'https://static.klipy.com/b.mp4', width: 640, height: 360 },
                  },
                  xs: { jpg: { url: 'https://static.klipy.com/b.jpg', width: 160, height: 90 } },
                },
              },
            ],
            current_page: 1,
            per_page: 50,
            has_next: false,
          },
        }),
      }),
    )

    // `?gifs=klipy`, not `stub`: the shelf switch now keeps every surface off a
    // provider, backdrop included, which is what the sibling test below checks.
    await page.goto('/room/DEV?seed=42&phase=brief&as=p2&gifs=klipy')
    await expect(page.getByText('Jesse is scrolling for a GIF.')).toBeVisible()

    const backdrop = page.locator('[data-testid="scene-backdrop"]')
    // The clip hangs off a `<source>`, which is what lets the element carry a
    // poster the browser shows without fetching a byte of video.
    await expect(backdrop.locator('source')).toHaveAttribute('src', /\.mp4$/)

    // Playback starts off and a client island turns it on — ADR 0005. The
    // suite resolves every host but the dev server to nothing, so the clip
    // never loads here; what is checkable is the contract around it.
    await expect(backdrop).not.toHaveAttribute('autoplay', /.*/)
    await expect(backdrop).toHaveAttribute('poster', /\.jpg$/)

    // Inert, and behind the words rather than over them: the headline used to
    // sit *under* the scrim, which is what a positioned child inside the same
    // stacking context does to an unpositioned sibling.
    const layers = await page.evaluate(() => {
      const media = document.querySelector('[data-testid="scene-backdrop"]')!
      const shell = media.closest('div')!
      const headline = document.querySelector('h1')!
      // `compareDocumentPosition` gives paint order for siblings in one context.
      return {
        hidden: shell.getAttribute('aria-hidden'),
        headlineAfter: Boolean(
          shell.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      }
    })
    expect(layers.hidden).toBe('true')
    expect(layers.headlineAfter).toBe(true)

    // The clip is somebody's work and says so. No link any more — the provider
    // publishes a title, not an uploader page.
    await expect(page.getByText(/Backdrop .* via KLIPY/)).toBeVisible()
  })

  test('waits without a backdrop rather than breaking when none resolves', async ({
    page,
  }) => {
    // The ordinary offline case, and the one the rest of this suite runs in: no
    // key, no network, no lookup. A decoration that has not arrived is simply a
    // decoration that has not arrived, and the wait still reads without it.
    await page.goto('/room/DEV?seed=42&phase=brief&as=p2&gifs=stub')

    await expect(page.getByText('Jesse is scrolling for a GIF.')).toBeVisible()
    await expect(page.locator('[data-testid="scene-backdrop"]')).toHaveCount(0)
    await expect(page.getByText(/Backdrop/)).toHaveCount(0)
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
