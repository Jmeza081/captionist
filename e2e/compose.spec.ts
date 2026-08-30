import { expect, test } from '@playwright/test'

/**
 * Answering the round.
 *
 * `?as=p2` is doing real work here: round one's role holder is `p0`, and the
 * role holder sits the round out — so as the host you only ever see the watch
 * face, and the two caption fields are unreachable without taking another seat.
 */
test.describe('composing', () => {
  test('captions the image, and the preview shows what the room will see', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')

    await expect(page.getByText('Make it hurt. Make it funny.')).toBeVisible()
    await expect(page.getByText('0 of 4 have submitted')).toBeVisible()

    // Blocked until there is something to submit.
    await expect(page.getByRole('button', { name: 'Write something first' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Top text' }).fill('Prod’s down again')
    await expect(page.getByText('17 / 60')).toBeVisible()

    // The preview is the same card the vote grid will render, so the overlay
    // has to track the field as it is typed.
    await expect(page.locator('figure').getByText('Prod’s down again')).toBeVisible()

    await page.getByRole('button', { name: 'Submit caption' }).click()
    await expect(page.getByRole('status')).toHaveText('Caption submitted')
    await expect(page.getByText('1 of 4 have submitted')).toBeVisible()
  })

  test('shrinks the caption a step per line, and keeps it inside the image', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')

    const field = page.getByRole('textbox', { name: 'Top text' })
    const overlay = page.locator('figure span').filter({ hasText: /./ }).first()

    const sizeOf = async (): Promise<number> =>
      overlay.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))

    await field.fill('Prod is down')
    const oneLine = await sizeOf()

    // Each step down is what keeps the block of text about the height one line
    // was, instead of a long caption filling the card corner to corner.
    await field.fill('Prod is down and nobody has')
    const twoLines = await sizeOf()
    expect(twoLines).toBeLessThan(oneLine)

    await field.fill('Prod is down and nobody has said anything about it yet at all')
    const fourLines = await sizeOf()
    expect(fourLines).toBeLessThan(twoLines)

    // And whatever it is set at, it stays inside the picture. The frame clips,
    // so an overlay that outgrew it used to lose its bottom half silently.
    const clipped = await overlay.evaluate((el) => {
      const frame = el.parentElement!
      const text = el.getBoundingClientRect()
      const box = frame.getBoundingClientRect()
      return text.bottom > box.bottom + 1 || text.top < box.top - 1
    })
    expect(clipped).toBe(false)

    // A single unbroken word longer than the card breaks rather than running
    // off both sides of it.
    await field.fill('supercalifragilisticexpialidocious')
    const overflowed = await overlay.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(overflowed).toBe(false)
  })

  test('hands over to the wait once your entry is in, with no second bite', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')

    await page.getByRole('textbox', { name: 'Top text' }).fill('First thought')
    await page.getByRole('button', { name: 'Submit caption' }).click()

    // Your round is over. The room's is not.
    await expect(page.getByText('Nice one. Now we wait.')).toBeVisible()
    await expect(page.getByText('1 of 4 have submitted')).toBeVisible()
    await expect(page.getByText('Locked in')).toBeVisible()

    // The composer is gone, and the rewrite it used to offer with it — a
    // caption you can keep editing until the clock dies is a different game.
    await expect(page.getByRole('textbox', { name: 'Top text' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Submit caption' })).toHaveCount(0)

    // Still `compose`: this is a per-viewer face, not the room moving on. The
    // host's early exit belongs to the real waiting phase and is not offered
    // here, where "everyone's in" is not yet true.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose')
    await expect(
      page.getByRole('button', { name: 'Everyone’s in — start voting' }),
    ).toHaveCount(0)
  })

  test('lets a blank player skip without holding up the room', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')

    await page.getByRole('button', { name: 'Skip this round' }).click()
    // Skipping still submits — an absent entry would stall everyone on a clock
    // nobody needs.
    await expect(page.getByText('1 of 4 have submitted')).toBeVisible()
  })

  test('answers a prompt with a GIF in the reversed mode', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&mode=react&as=p2&gifs=stub')

    await expect(page.getByText('Answer it with a GIF.')).toBeVisible()
    // The prompt is pinned, so the answer is always judged against it.
    await expect(page.getByText('Jesse’s prompt')).toBeVisible()

    await page.locator('button:has(img)').first().click()
    await expect(page.getByText('Your answer', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Lock in my answer' }).click()
    await expect(page.getByRole('status')).toHaveText('Answer locked in')
  })

  test('gives the role holder the round off', async ({ page }) => {
    // `p0` set this round up, so they watch it rather than competing.
    await page.goto('/room/DEV?seed=42&phase=compose&gifs=stub')

    await expect(page.getByText('They’re captioning your pick.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Top text' })).toHaveCount(0)
  })
})

/**
 * The other setting that was offered and never honoured.
 *
 * `ComposeScreen` never read `settings.format` at all — "One line" was a live
 * control in `/host` that changed a summary label and nothing else.
 */
test.describe('a one-line room', () => {
  test('asks for one caption instead of two', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&format=one&gifs=stub')

    await expect(page.getByRole('textbox', { name: 'Caption' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Top text' })).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Bottom text' })).toBeHidden()

    await page.getByRole('textbox', { name: 'Caption' }).fill('Ship it on Friday')
    // The preview is the card the room will vote on, so one line in means one
    // overlay out — nothing downstream needed changing for that to be true.
    await expect(page.locator('figure').getByText('Ship it on Friday')).toBeVisible()

    await page.getByRole('button', { name: 'Submit caption' }).click()
    await expect(page.getByRole('status')).toHaveText('Caption submitted')
  })

  test('still writes two lines when the room did not ask for one', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=compose&as=p2&gifs=stub')
    await expect(page.getByRole('textbox', { name: 'Top text' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Bottom text' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Caption', exact: true })).toBeHidden()
  })
})
