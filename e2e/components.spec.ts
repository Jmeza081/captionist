import { expect, test } from '@playwright/test'

// The gallery renders every built component in its states. These specs cover
// the behaviour that a static screenshot can't: the interactive components,
// and the design rules that are easy to regress silently.

test.describe('component gallery', () => {
  test('renders every section', async ({ page }) => {
    await page.goto('/components')

    await expect(
      page.getByRole('heading', { name: 'Built components' }),
    ).toBeVisible()

    for (const section of [
      'Button',
      'Segmented control',
      'Text field',
      'Toggle & stepper',
      'Status & labels',
      'Avatar & player rows',
      'Media card',
      'Prompt banner',
      'Chat',
      'Overlays',
    ]) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible()
    }
  })

  test('blocked buttons stay live and focusable, disabled ones do not', async ({
    page,
  }) => {
    await page.goto('/components')

    // "Blocked is not disabled" — the control keeps its click target and says
    // what's missing. See DESIGNSYSTEM.md §4.7.
    const blocked = page.getByRole('button', { name: 'Pick 2 more' })
    await expect(blocked).toBeEnabled()
    await blocked.focus()
    await expect(blocked).toBeFocused()

    await expect(
      page.getByRole('button', { name: 'Genuinely disabled' }),
    ).toBeDisabled()
  })

  test('the timer pill flips to urgent at 15 seconds', async ({ page }) => {
    await page.goto('/components')

    const neutral = page.getByRole('timer').filter({ hasText: '1:12' })
    const urgent = page.getByRole('timer').filter({ hasText: '0:09' })

    const neutralColor = await neutral.evaluate(
      (el) => getComputedStyle(el).color,
    )
    const urgentColor = await urgent.evaluate((el) => getComputedStyle(el).color)

    // #FF787D — the urgent token.
    expect(urgentColor).toBe('rgb(255, 120, 125)')
    expect(neutralColor).not.toBe(urgentColor)
  })

  test('the segmented control is a radiogroup and switches', async ({
    page,
  }) => {
    await page.goto('/components')

    const group = page.getByRole('radiogroup', { name: 'Game mode' })
    const react = group.getByRole('radio', { name: 'React to the caption' })

    await expect(
      group.getByRole('radio', { name: 'Caption the image' }),
    ).toBeChecked()

    await react.click()
    await expect(react).toBeChecked()
  })

  test('the toggle reports switch state', async ({ page }) => {
    await page.goto('/components')

    const toggle = page.getByRole('switch', {
      name: 'Let the picked player search Giphy',
    })

    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  test('the stepper steps and clamps at its bounds', async ({ page }) => {
    await page.goto('/components')

    const value = page.getByRole('spinbutton', {
      name: 'Submission time limit',
    })
    await expect(value).toHaveText('90 sec')

    await page.getByRole('button', { name: 'Increase Submission time limit' }).click()
    await expect(value).toHaveText('105 sec')

    // Walk to the 180 ceiling; the key must disable rather than overshoot.
    const up = page.getByRole('button', { name: 'Increase Submission time limit' })
    for (let i = 0; i < 5; i += 1) {
      if (await up.isDisabled()) break
      await up.click()
    }
    await expect(value).toHaveText('180 sec')
    await expect(up).toBeDisabled()
  })

  test('the caption counter tracks what you type', async ({ page }) => {
    await page.goto('/components')

    const field = page.getByLabel('Top text')
    await field.fill('When prod goes down on a friday')
    await expect(page.getByText('31 / 60')).toBeVisible()
  })

  test('the reaction toolbar searches by keyword', async ({ page }) => {
    await page.goto('/components')

    const toolbar = page.getByRole('dialog', { name: 'React to this caption' })
    // The tiles, not every button in the panel — the pack tabs are buttons too.
    const tiles = toolbar.getByRole('group', { name: 'Reactions' }).getByRole('button')

    // Unsearched, it shows the ten defaults — not the whole set.
    await expect(tiles).toHaveCount(10)

    // Narrows to the reactions that actually mention one, named rather than
    // counted — the count is a property of the corpus, which grows.
    await toolbar.getByLabel('Search reactions').fill('outage')
    await expect(toolbar.getByRole('button', { name: 'Incident' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'This is fine' })).toBeVisible()
    await expect(tiles).toHaveCount(2)

    await toolbar.getByLabel('Search reactions').fill('zzzz')
    await expect(toolbar.getByText(/Nothing matches/)).toBeVisible()
  })

  test('the reaction packs filter the grid, and search beats a pack', async ({ page }) => {
    await page.goto('/components')

    const toolbar = page.getByRole('dialog', { name: 'React to this caption' })
    const tiles = toolbar.getByRole('group', { name: 'Reactions' }).getByRole('button')

    // The four Slackmojis are the app's own art, and they sit in the defaults
    // — DESIGNSYSTEM §4.4 is "6 emoji + 4 Slackmoji GIFs".
    await expect(tiles.locator('img[src^="/media/slackmoji-"]')).toHaveCount(4)

    await toolbar.getByRole('button', { name: 'Slackmojis' }).click()
    await expect(tiles).toHaveCount(4)

    await toolbar.getByRole('button', { name: 'Objects' }).click()
    // Not "this pack has no pictures" any more — the imported catalog put 88 of
    // them in here. What still holds is that the Slackmojis are their own pack,
    // and that a curated character tile keeps its place among them.
    await expect(toolbar.getByRole('button', { name: 'Fire', exact: true })).toBeVisible()
    await expect(tiles.locator('img[src^="/media/slackmoji-"]')).toHaveCount(0)

    // A search overrides whichever pack is open, rather than being narrowed
    // by it — §4.4 makes search the long-tail answer.
    await toolbar.getByLabel('Search reactions').fill('laugh')
    await expect(toolbar.getByRole('button', { name: 'Crying with laughter' })).toBeVisible()

    // Recent starts empty and says so, rather than showing a blank grid.
    await toolbar.getByRole('button', { name: 'Recent' }).click()
    await expect(toolbar.getByText(/Nothing here yet/)).toBeVisible()
  })

  test('the modal opens, steps, and closes on Escape', async ({ page }) => {
    await page.goto('/components')

    await page.getByRole('button', { name: 'Open the house rules' }).click()

    const modal = page.getByRole('dialog', { name: 'How Captionist works' })
    await expect(modal).toBeVisible()
    await expect(modal.getByText('Step 1 of 4')).toBeVisible()

    // Back is disabled on the first step; Next advances.
    await expect(modal.getByRole('button', { name: 'Back' })).toBeDisabled()
    await modal.getByRole('button', { name: 'Next' }).click()
    await expect(modal.getByText('Step 2 of 4')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })

  test('the chat rail collapses to a strip that keeps the unread count', async ({
    page,
  }) => {
    await page.goto('/components')

    await expect(page.getByRole('complementary', { name: 'Room chat' })).toBeVisible()

    await page.getByRole('button', { name: 'Collapse chat rail' }).click()

    const strip = page.getByRole('complementary', { name: 'Room chat, collapsed' })
    await expect(strip).toBeVisible()
    await expect(
      strip.getByRole('button', { name: 'Open chat, 3 unread messages' }),
    ).toBeVisible()
  })

  test('the host toolbox opens and drives its own clock', async ({ page }) => {
    await page.goto('/components')

    await page.getByRole('button', { name: 'Open host toolbox' }).click()

    const toolbox = page.getByRole('region', { name: 'Host toolbox' })
    await expect(toolbox).toBeVisible()

    await expect(page.getByText('Toolbox clock reads 0:22')).toBeVisible()
    await toolbox.getByRole('button', { name: 'Increase Round timer' }).click()
    await expect(page.getByText('Toolbox clock reads 0:32')).toBeVisible()
  })

  test('every focusable control takes a visible focus ring', async ({ page }) => {
    await page.goto('/components')

    // Sample the ring on one control per interaction pattern rather than
    // asserting on all of them — the mixin is shared, so one break is all.
    for (const name of ['Start round', 'Pick 2 more', 'Add a reaction']) {
      const control = page.getByRole('button', { name }).first()
      await control.focus()
      const shadow = await control.evaluate(
        (el) => getComputedStyle(el).boxShadow,
      )
      // inset 0 0 0 2px #7B61FF
      expect(shadow).toContain('123, 97, 255')
    }
  })

  test('captures the gallery', async ({ page }, testInfo) => {
    await page.goto('/components')
    await expect(
      page.getByRole('heading', { name: 'Built components' }),
    ).toBeVisible()

    const shot = await page.screenshot({ fullPage: true })
    await testInfo.attach(`components-${testInfo.project.name}`, {
      body: shot,
      contentType: 'image/png',
    })
  })

  test('the gallery does not scroll horizontally', async ({ page }) => {
    await page.goto('/components')

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflows).toBe(false)
  })
})

// --- compositions -----------------------------------------------------------

test.describe('compositions', () => {
  test('the composer only sends with text or an attachment', async ({ page }) => {
    await page.goto('/components')

    const composer = page
      .getByLabel('Message the room')
      .locator('xpath=ancestor::form')
    const send = composer.getByRole('button', { name: 'Send message' })

    // Empty: nothing to send.
    await expect(send).toBeDisabled()

    await page.getByLabel('Message the room').fill('deploying on a friday')
    await expect(send).toBeEnabled()

    // Whitespace alone is not a message.
    await page.getByLabel('Message the room').fill('   ')
    await expect(send).toBeDisabled()
  })

  test('attaching a GIF alone is enough to send', async ({ page }) => {
    await page.goto('/components')

    const send = page
      .getByLabel('Message the room')
      .locator('xpath=ancestor::form')
      .getByRole('button', { name: 'Send message' })
    await expect(send).toBeDisabled()

    // Open the panel from the composer, pick one: it attaches and closes.
    const gifKey = page.getByRole('button', { name: 'Attach a GIF', exact: true })
    await expect(gifKey).toHaveAttribute('aria-expanded', 'false')
    await gifKey.click()
    await expect(gifKey).toHaveAttribute('aria-expanded', 'true')

    const panel = page.getByRole('dialog', { name: 'Attach a GIF' }).first()
    await expect(panel).toBeVisible()

    await panel.getByRole('button', { name: /Attach a rocket/ }).click()
    await expect(gifKey).toHaveAttribute('aria-expanded', 'false')

    // Staged, and now sendable with no text at all.
    await expect(page.getByText('GIF attached')).toBeVisible()
    await expect(send).toBeEnabled()

    await page.getByRole('button', { name: 'Remove attached GIF' }).click()
    await expect(send).toBeDisabled()
  })

  test('the GIF panel searches by keyword', async ({ page }) => {
    await page.goto('/components')

    const panel = page.getByRole('dialog', { name: 'Attach a GIF' }).last()
    await panel.getByLabel('Search GIFs').fill('friday')
    await expect(panel.getByRole('button', { name: /Attach a rocket/ })).toBeVisible()
    await expect(panel.getByRole('button', { name: /^Attach/ })).toHaveCount(1)

    await panel.getByLabel('Search GIFs').fill('zzzz')
    await expect(panel.getByText(/No GIFs for/)).toBeVisible()
  })

  test('the reveal bar caps at five reactions and toggles them', async ({
    page,
  }) => {
    await page.goto('/components')

    const bar = page.getByText('React', { exact: true }).locator('xpath=..')
    // Six are supplied; the design caps the row at five.
    await expect(bar.getByRole('button', { name: /^React with/ })).toHaveCount(5)

    const fire = bar.getByRole('button', { name: 'React with Fire' })
    await expect(fire).toHaveAttribute('aria-pressed', 'false')
    await fire.click()
    await expect(fire).toHaveAttribute('aria-pressed', 'true')
  })

  test('reaction floaters are decorative and never block a click', async ({
    page,
  }) => {
    await page.goto('/components')

    const bar = page.getByText('React', { exact: true }).locator('xpath=..')
    await bar.getByRole('button', { name: 'React with Skull' }).click()

    // The burst layer is hidden from assistive tech and transparent to input,
    // so the next reaction is still clickable straight away.
    const layer = page.locator('div[aria-hidden="true"]').filter({ hasText: '💀' })
    await expect(layer.first()).toHaveCSS('pointer-events', 'none')

    await bar.getByRole('button', { name: 'React with Fire' }).click()
    await expect(
      bar.getByRole('button', { name: 'React with Fire' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('code entry normalises input and reports a bad code', async ({ page }) => {
    await page.goto('/components')

    const input = page.getByRole('textbox', { name: 'Room code' }).first()
    await input.fill('')
    await input.pressSequentially('f3-4a b2')

    // Lowercase upper-cased, separators and spaces dropped, capped at six.
    await expect(input).toHaveValue('F34AB2')

    // The error names what happened and what to do next, and is announced.
    const errored = page.getByRole('textbox', { name: 'Room code' }).nth(1)
    await expect(errored).toHaveAttribute('aria-invalid', 'true')
    await expect(
      page.getByText(/That room code doesn't exist\. Check the code/),
    ).toBeVisible()
  })

  test('the podium reads 1-2-3 in the DOM but centres the winner', async ({
    page,
  }) => {
    await page.goto('/components')

    const places = page.getByRole('listitem').filter({ hasText: 'pts' })
    await expect(places).toHaveCount(3)

    // DOM order is the standings order.
    await expect(places.nth(0)).toContainText('Lukasz')
    await expect(places.nth(1)).toContainText('Jack')
    await expect(places.nth(2)).toContainText('Jesska')

    // Visual order puts first in the middle.
    const boxes = await places.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().left),
    )
    expect(boxes[1]).toBeLessThan(boxes[0])
    expect(boxes[0]).toBeLessThan(boxes[2])
  })

  test('a room code is announced to screen readers character by character', async ({
    page,
  }) => {
    await page.goto('/components')

    // Read aloud far more often than it is typed, so it is spelled out rather
    // than left for a screen reader to pronounce as a word.
    await expect(page.getByText(/Room code: C - F 3 4 2 1 3/).first()).toBeAttached()
    await expect(page.getByRole('heading', { name: 'Scan to join' })).toBeVisible()
  })

  test('the app header states the mode first in its settings line', async ({
    page,
  }) => {
    await page.goto('/components')

    // The mode leads: it's how a late joiner learns which way round the game
    // runs. See DESIGNSYSTEM.md §4.9.
    const settings = page.getByText(
      'React to the caption · 5 rounds · 90s · rank top 3',
    )
    await expect(settings).toBeVisible()

    // The in-round header pairs the phase with the clock.
    const header = page.locator('header').filter({ hasText: 'Round 2 of 5' })
    await expect(header).toBeVisible()
    await expect(header.getByRole('timer')).toBeVisible()
  })
})

test.describe('the phase-3 atoms', () => {
  test('a rank slot says what it holds, and an empty one says it is empty', async ({
    page,
  }) => {
    await page.goto('/components')

    // The tint and the dashed outline are colour and shape — neither reaches a
    // screen reader, so the label has to carry the state.
    await expect(
      page.getByRole('button', { name: 'Clear 1st: It compiles. Ship it.' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: '3rd, empty' })).toBeVisible()
  })

  test('a status pill carries its second clause', async ({ page }) => {
    await page.goto('/components')

    await expect(page.getByText('Locked in')).toBeVisible()
    await expect(page.getByText('4 of 7 have voted')).toBeVisible()
    await expect(page.getByText(/can’t vote in their own duel/)).toBeVisible()
  })

  /**
   * The shape band.
   *
   * A card is drawn at its image's own ratio, clamped — see `mediaAspect`.
   * Asserted on the rendered box rather than the helper, because the number
   * has to survive a custom property, a `var()` fallback and `aspect-ratio`
   * to mean anything, and any one of those failing leaves the card square
   * with nothing else to notice.
   */
  test('draws a card at its image’s ratio, clamped at both ends', async ({ page }) => {
    await page.goto('/components#media')

    const ratioOf = async (alt: string) => {
      const box = await page.getByRole('img', { name: alt }).boundingBox()
      expect(box).not.toBeNull()
      return (box?.width ?? 0) / (box?.height ?? 1)
    }

    // 16:9 in, 4:3 out — squared off it showed 56% of the frame.
    expect(await ratioOf('A wide frame')).toBeCloseTo(4 / 3, 1)
    // 9:16 in, 4:5 out, so a tall GIF is never a column in a vote grid.
    expect(await ratioOf('A tall frame')).toBeCloseTo(4 / 5, 1)
    // And a source that never reported a size is the square it always was.
    expect(await ratioOf('A frame with no size')).toBeCloseTo(1, 1)
  })
})

test.describe('television static', () => {
  test('actually regenerates, rather than sliding one field about', async ({ page }) => {
    await page.goto('/components#tv-static')

    const sets = page.locator('#tv-static [data-testid="tv-static"]')
    await expect(sets.first()).toBeVisible()

    /**
     * The bug this guards is specific and was invisible to every other check.
     *
     * The first version translated a *repeating* noise tile. Its transform
     * really did change every frame — a computed-style assertion passed happily
     * — and it still looked like it was not moving, because sliding a periodic
     * pattern keeps consecutive frames correlated. So this asserts the painted
     * pixels, which is the only thing that could tell the difference.
     */
    const frames = async (index: number) => {
      const seen = new Set<string>()
      for (let i = 0; i < 4; i += 1) {
        seen.add((await sets.nth(index).screenshot({ animations: 'allow' })).toString('base64'))
        await page.waitForTimeout(80)
      }
      return seen.size
    }

    expect(await frames(0)).toBeGreaterThan(1)
    // And the paused one is genuinely one picture, not a slower one.
    expect(await frames(1)).toBe(1)
  })

  test('gives every set its own picture', async ({ page }) => {
    await page.goto('/components#tv-static')

    // Twenty of these sit side by side on the landing wall. In lockstep they
    // read as one sheet of noise behind a grille rather than as a wall of
    // televisions, so each takes a seed that offsets its field and its phase.
    const wall = page.locator('#tv-static [class*="staticWall"] [data-testid="tv-static"]')
    await expect(wall).toHaveCount(6)

    const seeds = await wall.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).style.getPropertyValue('--set')),
    )
    expect(new Set(seeds).size).toBe(6)
  })
})
