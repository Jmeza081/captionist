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
    // The code was the only thing missing: a name is suggested on arrival.
    await expect(page.getByRole('button', { name: 'Join the room' })).toBeVisible()

    // Clearing it puts the block back, and the label still says what to do.
    await page.getByRole('textbox', { name: 'Nickname' }).fill('')
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

  test('takes the code from the link, and still asks who is arriving', async ({
    page,
  }) => {
    await page.goto('/join/C-F34213')

    // The link carries the code and the screen suggests a name, so the CTA is
    // ready rather than blocked. It is still the same screen and still the same
    // button: nobody is seated until they press it.
    await expect(page.getByRole('textbox', { name: 'Room code' })).toHaveValue('F344J3')
    await expect(page.getByRole('textbox', { name: 'Nickname' })).toHaveValue(
      /^[A-Z][a-z]+_[A-Z][a-z]+$/,
    )
    await expect(page.getByRole('button', { name: 'Join the room' })).toBeVisible()
    await expect(page).toHaveURL(/\/join\//)

    // The suggestion is a starting point, not a verdict — both halves of who
    // you are stay yours to change before you ask for a seat.
    await page.getByRole('textbox', { name: 'Nickname' }).fill('Vic')
    await page.getByRole('radio', { name: 'Fern' }).click()
    await expect(page.getByRole('textbox', { name: 'Nickname' })).toHaveValue('Vic')
    await expect(page.getByRole('radio', { name: 'Fern' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('offers the way out to whoever arrived before the host', async ({ page }) => {
    await page.goto('/join')

    await page.getByRole('link', { name: 'Make your own' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test('remembers the face, and suggests a new name every time', async ({ page }) => {
    await page.goto('/join')
    // Arriving with one already, so nobody has to think of a nickname to play.
    const nickname = page.getByRole('textbox', { name: 'Nickname' })
    await expect(nickname).toHaveValue(/^[A-Z][a-z]+_[A-Z][a-z]+$/)

    await page.getByRole('textbox', { name: 'Room code' }).fill('F34213')
    await nickname.fill('Roberto')
    // Named for the seed rather than a position, which is what makes this
    // assertion mean anything: the window the picker offers is a function of
    // the stored seed, so coming back reproduces it.
    await page.getByRole('radio', { name: 'Fern' }).click()
    await page.getByRole('button', { name: 'Join the room' }).click()
    await expect(page).toHaveURL(/\/room\//)

    await page.goto('/join')
    // The face is yours and comes back. The name does not: a remembered one is
    // worse than useless when the next tab is the next player.
    await expect(page.getByRole('radio', { name: 'Fern' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(nickname).not.toHaveValue('Roberto')
    await expect(nickname).toHaveValue(/^[A-Z][a-z]+_[A-Z][a-z]+$/)
  })

  test('shuffles what is on offer without shuffling away your pick', async ({ page }) => {
    await page.goto('/join')

    const faces = page.getByRole('radiogroup', { name: 'Pick your face' })
    await faces.getByRole('radio', { name: 'Fern' }).click()

    const offered = () => faces.getByRole('radio').evaluateAll((els) => els.map((el) => el.ariaLabel))
    const before = await offered()
    expect(before).toHaveLength(10)

    await page.getByRole('button', { name: 'Shuffle faces' }).click()
    const after = await offered()

    // Nine of the ten are redrawn from the other sixty-nine; the odds of
    // reproducing the same nine are not worth writing down.
    expect(after).not.toEqual(before)
    expect(after).toContain('Fern')
    await expect(faces.getByRole('radio', { name: 'Fern' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  /**
   * The screen's own layout, which is a claim about reach rather than looks.
   *
   * `/join` was the one front door that stayed a bare column at every width;
   * it now shares `/host`'s surface, so it inherits `/host`'s two assertions —
   * the CTA is in reach without scrolling, and the wall is the larger half on
   * a desktop and absent on a phone. Both projects run this file, and the
   * split turns on at `xl` (1280px), so the tests branch on the viewport
   * rather than skipping: "no wall on a phone" is as much the requirement as
   * "a wall on a desktop".
   */
  test('keeps both ways out in reach without scrolling', async ({ page }) => {
    await page.goto('/join')

    // Not `toBeVisible` — that is true of anything below the fold. A guest
    // must not have to scroll past a face picker to find either of these.
    await expect(page.getByRole('button', { name: 'Enter the code' })).toBeInViewport()
    await expect(page.getByRole('link', { name: 'Make your own' })).toBeInViewport()
  })

  test('shows the wall beside the form on a desktop, and not on a phone', async ({ page }) => {
    await page.goto('/join')

    const wall = page.locator('[data-testid="hero-wall"]')
    const split = (page.viewportSize()?.width ?? 0) >= 1280

    if (split) {
      await expect(wall).toBeVisible()
      // The form is entirely to the left of where the wall's column begins.
      const field = await page.getByRole('textbox', { name: 'Nickname' }).boundingBox()
      expect(field).not.toBeNull()
      expect(field?.x ?? 0).toBeLessThan((page.viewportSize()?.width ?? 0) * 0.4)
    } else {
      await expect(wall).toBeHidden()
    }
  })

  test('holds the ten faces on one line wherever the card can', async ({ page }) => {
    await page.goto('/join')

    const faces = page.getByRole('radiogroup', { name: 'Pick your face' })
    await expect(faces.getByRole('radio')).toHaveCount(10)

    // The picker asks its own container, not the viewport — so this is really
    // a question about the card, and the card is 600px at every width the
    // design draws it at.
    const rows = await faces.evaluate(
      (el) =>
        new Set(Array.from(el.children).map((k) => Math.round(k.getBoundingClientRect().top)))
          .size,
    )
    expect(rows).toBe(page.viewportSize()!.width >= 768 ? 1 : 2)
  })

  test('gives the card the width the design draws it at', async ({ page }) => {
    test.skip(page.viewportSize()!.width < 1280, 'the split only exists from `xl`')
    await page.goto('/join')

    // The form column used to be `40fr`, so at 1280 the 600px card rendered at
    // 472 — which is what left the avatar picker without room for one line of
    // ten. The column is sized to the card now and the wall takes the rest.
    const card = await page.getByRole('textbox', { name: 'Nickname' }).evaluate((el) => {
      const box = el.closest('[class*="card"]') as HTMLElement
      return Math.round(box.getBoundingClientRect().width)
    })
    expect(card).toBe(600)
  })

  test('keeps the seven code slots on one line at every width', async ({ page }) => {
    await page.goto('/join')

    // The row must never wrap — a code broken across two lines stops reading
    // as a code — and from `xl` the card it sits in is a 40% column, narrower
    // than seven `lg` slots are drawn. They give up width instead of
    // overflowing, which is a thing only the rendered box can tell us.
    const row = page.locator('[data-testid="code-slots"]')
    const overflow = await row.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    const tops = await row
      .locator('span')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
    expect(tops).toHaveLength(7)
    expect(new Set(tops).size).toBe(1)
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
