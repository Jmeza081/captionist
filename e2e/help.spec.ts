import { expect, test } from '@playwright/test'

// Selector policy: getByRole > data-testid > CSS. Never target hashed
// `.module.scss` class names — they change on every build.

/**
 * The walkthrough, which is the same surface everywhere it opens from: the
 * landing nav, the host's setup screen, the lobby's help key and the room
 * toolbox. The lobby is the cheapest door to it, so most of this runs there.
 */
test.describe('the walkthrough', () => {
  test('opens from the landing page rather than jumping to nothing', async ({ page }) => {
    test.skip(
      page.viewportSize()!.width < 768,
      'the nav’s text links stand down on a phone',
    )
    await page.goto('/')

    await page.getByRole('button', { name: 'How it works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    await expect(dialog).toBeVisible()
    // No room yet, so no format is in play: it opens on captions.
    await expect(dialog.getByText('Someone picks the image')).toBeVisible()
  })

  test('shows an illustration beside the copy, and above it on a phone', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    const media = dialog.getByTestId('modal-rail')
    await expect(media).toBeVisible()

    const art = (await media.boundingBox())!
    const heading = (await dialog.getByRole('heading', { level: 2 }).boundingBox())!

    if (page.viewportSize()!.width < 768) {
      // Stacked, art first — which keeps Back and Next the last thing on the
      // card rather than stranding them above a picture.
      expect(art.y + art.height).toBeLessThan(heading.y)
    } else {
      // The design's 300px right rail.
      expect(art.x).toBeGreaterThan(heading.x + heading.width - 1)
    }
  })

  test('explains the other format without changing the room', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    const switcher = dialog.getByRole('radiogroup', { name: 'Which format to explain' })

    await dialog.getByRole('button', { name: 'Next' }).click()
    await expect(dialog.getByText('Step 2 of 4')).toBeVisible()

    await switcher.getByRole('radio', { name: 'React to the caption' }).click()
    await expect(
      switcher.getByRole('radio', { name: 'React to the caption' }),
    ).toBeChecked()

    // The other format, from the top — step 2 of captions is not step 2 of
    // prompts, so switching restarts rather than holding its place.
    await expect(dialog.getByText('Someone writes the prompt')).toBeVisible()
    await expect(dialog.getByText('Step 1 of 4')).toBeVisible()

    await page.keyboard.press('Escape')

    // Reading is not a setting: the room is still in caption mode, and
    // reopening starts from the format actually in play.
    await expect(
      page.getByRole('radiogroup', { name: 'Game mode' }).getByRole('radio', {
        name: 'Caption the image',
      }),
    ).toBeChecked()

    await page.getByRole('button', { name: 'How Captionist works' }).click()
    await expect(dialog.getByText('Someone picks the image')).toBeVisible()
  })

  test('keeps one height across every step, in both formats', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    const switcher = dialog.getByRole('radiogroup', { name: 'Which format to explain' })
    const heights: number[] = []

    for (const format of ['Caption the image', 'React to the caption']) {
      await switcher.getByRole('radio', { name: format }).click()
      for (let step = 0; step < 4; step += 1) {
        heights.push((await dialog.boundingBox())!.height)
        // Nothing should be cut off at that fixed height either.
        expect(
          await dialog.evaluate((el) => el.scrollHeight - el.clientHeight),
        ).toBeLessThanOrEqual(1)
        if (step < 3) await dialog.getByRole('button', { name: 'Next' }).click()
      }
      for (let back = 0; back < 3; back += 1) {
        await dialog.getByRole('button', { name: 'Back' }).click()
      }
    }

    // The steps differ by a line or two of copy. The card must not resize
    // under a Next click — that reads as a jump rather than a transition.
    expect(Math.max(...heights) - Math.min(...heights)).toBe(0)
  })

  test('closes on a click outside it', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    await expect(dialog).toBeVisible()

    // The backdrop, well clear of the card.
    await page.mouse.click(4, 4)
    await expect(dialog).toHaveCount(0)

    // And the room is untouched behind it — this was never a pause.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
  })

  test('survives a selection drag that ends past its edge', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    const card = (await dialog.boundingBox())!

    // A click fires on the common ancestor of its press and release, so
    // selecting the body text and letting go past the edge targets the
    // backdrop. Reading the thing must not close it.
    await page.mouse.move(card.x + 20, card.y + card.height / 2)
    await page.mouse.down()
    await page.mouse.move(2, 2, { steps: 8 })
    await page.mouse.up()

    await expect(dialog).toBeVisible()
  })
})
