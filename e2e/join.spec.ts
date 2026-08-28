import { expect, test } from '@playwright/test'

/**
 * The way into somebody else's room.
 *
 * `/join` collects the three things a seat needs — which room, what to call
 * you, which face — *before* the transport is asked for one. Nothing here
 * touches a room: the code is validated by the same `normalizeCode` the room
 * route uses, and whether anyone is hosting it is a question only the transport
 * can answer, after the push.
 */
test.describe('joining', () => {
  test('asks for the three things a seat needs', async ({ page }) => {
    await page.goto('/join')

    await expect(page.getByRole('heading', { name: 'Got a room code?' })).toBeVisible()
    await expect(page.getByText('Ask whoever is sharing their screen.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Room code' })).toBeVisible()
    const faces = page.getByRole('radiogroup', { name: 'Pick your face' })
    await expect(faces).toBeVisible()
    // `ember` is the catalogue's first seed and the default a browser with no
    // stored identity gets, so the opening window is always page one.
    await expect(faces.getByRole('radio', { name: 'Ember' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Nickname' })).toBeVisible()
    await expect(page.getByText('Codes are 7 characters and always start with C')).toBeVisible()
  })

  test('blocks the join and names what is still missing', async ({ page }) => {
    await page.goto('/join')

    // Blocked, never disabled — the label carries the reason, and the control
    // stays live and focusable.
    const cta = page.getByRole('button', { name: 'Enter the code' })
    await expect(cta).toBeVisible()
    await expect(cta).not.toBeDisabled()

    await page.getByRole('textbox', { name: 'Room code' }).fill('F34213')
    await expect(page.getByRole('button', { name: 'Pick a name first' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Nickname' }).fill('Vic')
    await expect(page.getByRole('button', { name: 'Join the room' })).toBeVisible()
  })

  test('folds the characters people misread, then goes to that room', async ({ page }) => {
    await page.goto('/join')

    // `0` and `1` are not in the alphabet — they fold onto `Q` and `J`, so a
    // code read down a call survives whichever half of the pair you reach for.
    await page.getByRole('textbox', { name: 'Room code' }).fill('F01783')
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Vic')
    await page.getByRole('button', { name: 'Join the room' }).click()

    await expect(page).toHaveURL(/\/room\/C-FQJ783$/)
  })

  test('takes the code from the link, so a scanned QR only asks for a name', async ({
    page,
  }) => {
    await page.goto('/join/C-F34213')

    await expect(page.getByRole('textbox', { name: 'Room code' })).toHaveValue('F344J3')
    await expect(page.getByRole('button', { name: 'Pick a name first' })).toBeVisible()
  })

  test('offers the way out to whoever arrived before the host', async ({ page }) => {
    await page.goto('/join')

    await page.getByRole('link', { name: 'Make your own' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test('remembers the name and face for the next room', async ({ page }) => {
    await page.goto('/join')
    await page.getByRole('textbox', { name: 'Room code' }).fill('F34213')
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Roberto')
    // Named for the seed rather than a position, which is what makes this
    // assertion mean anything: the window the picker offers is a function of
    // the stored seed, so coming back reproduces it.
    await page.getByRole('radio', { name: 'Fern' }).click()
    await page.getByRole('button', { name: 'Join the room' }).click()
    await expect(page).toHaveURL(/\/room\//)

    await page.goto('/join')
    await expect(page.getByRole('textbox', { name: 'Nickname' })).toHaveValue('Roberto')
    await expect(page.getByRole('radio', { name: 'Fern' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('shuffles what is on offer without shuffling away your pick', async ({ page }) => {
    await page.goto('/join')

    const faces = page.getByRole('radiogroup', { name: 'Pick your face' })
    await faces.getByRole('radio', { name: 'Fern' }).click()

    const offered = () => faces.getByRole('radio').evaluateAll((els) => els.map((el) => el.ariaLabel))
    const before = await offered()
    expect(before).toHaveLength(8)

    await page.getByRole('button', { name: 'Shuffle faces' }).click()
    const after = await offered()

    // Seven of the eight are redrawn from the other sixty-three; the odds of
    // reproducing the same seven are about one in half a billion.
    expect(after).not.toEqual(before)
    expect(after).toContain('Fern')
    await expect(faces.getByRole('radio', { name: 'Fern' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('walks the faces with the arrow keys', async ({ page }) => {
    await page.goto('/join')

    const faces = page.getByRole('radiogroup', { name: 'Pick your face' })
    // Roving tabindex: the group is one tab stop, and the arrows move within
    // it. Without them the other seven would be unreachable.
    await faces.getByRole('radio', { name: 'Ember' }).focus()
    await page.keyboard.press('ArrowRight')

    await expect(faces.getByRole('radio', { name: 'Sunfish' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(faces.getByRole('radio', { name: 'Sunfish' })).toBeFocused()
  })
})
