import { expect, test } from '@playwright/test'

/**
 * The lobby, which is only observable *without* `?bots=`: the autopilot starts
 * the game the instant the room fills, so a bots room has no lobby to look at.
 */
test.describe('the lobby', () => {
  test('shows the room, the roster and a live start button', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')

    // The fixture boots its own room, so the code comes from state — not the URL.
    // `toContainText`: the code is rendered twice, once visibly and once
    // spelled out for screen readers.
    await expect(page.getByTestId('room-code')).toContainText('C-F34213')
    await expect(page.getByRole('listitem')).toHaveCount(5)
    await expect(page.getByText('Jesse')).toBeVisible()

    const start = page.getByRole('button', { name: 'Start game — 5 players ready' })
    await expect(start).toBeVisible()
    await start.click()

    // The opener is a real phase with its own clock, so the room passes
    // through it on the way to the brief.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'opener')
  })

  test('explains the game without leaving the lobby', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')

    // The help key sits beside the mode toggle, so a host can still learn the
    // format — or change it — before the first round starts.
    await page.getByRole('button', { name: 'How Captionist works' }).click()
    await expect(page.getByText('Someone picks the image')).toBeVisible()

    // It is an overlay, never a pause: the room is untouched behind it.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    await page.keyboard.press('Escape')
    await expect(page.getByText('Someone picks the image')).toHaveCount(0)
  })

  test('reads the roster left to right rather than one name per row', async ({ page }) => {
    test.skip(page.viewportSize()!.width < 768, 'single column below the breakpoint')
    await page.goto('/room/DEV?seed=42&phase=lobby')
    // Measure the roster, not whatever list is on screen first. The boot
    // interstitial's steps are list items too, and `boundingBox` does not wait
    // for the *right* list — so without this the measurement races the room.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const rows = page.getByRole('listitem')
    const first = await rows.nth(0).boundingBox()
    const second = await rows.nth(1).boundingBox()

    // Same row, side by side — a room of twenty should not be a column you
    // have to scroll to count.
    expect(second!.y).toBeCloseTo(first!.y, 0)
    expect(second!.x).toBeGreaterThan(first!.x)
  })

  test('keeps the help key on the mode toggle’s row, even on a phone', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')

    const toggle = (await page.getByRole('radiogroup').boundingBox())!
    const help = (await page.getByRole('button', { name: 'How Captionist works' }).boundingBox())!

    // Two mode labels are wider than a phone, and flex wraps before it
    // shrinks — so without the control narrowing, the key drops to its own
    // line. It sits to the right of the toggle, overlapping its rows.
    expect(help.x).toBeGreaterThan(toggle.x + toggle.width - 1)
    expect(help.y).toBeLessThan(toggle.y + toggle.height)
    expect(help.y + help.height).toBeGreaterThan(toggle.y)
  })

  test('offers a guest nothing that is the host’s to do', async ({ page }) => {
    // `?as=` takes a seat that is not the host's.
    await page.goto('/room/DEV?seed=42&phase=lobby&as=p2')

    // Starting and switching mode are both host-only, so offering either would
    // hand a guest a control that can only refuse them. The share block goes
    // with them: a guest handed a QR would be inviting people to a room that
    // is not theirs.
    await expect(page.getByRole('button', { name: /Start game/ })).toHaveCount(0)
    await expect(page.getByRole('radiogroup')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0)
    await expect(page.getByText('Waiting on the host to start')).toBeVisible()
  })

  /**
   * The guest lobby is its own artboard, not the host's with controls hidden:
   * one centred column, a headline at display scale, one card, and the rules
   * read-only underneath the roster.
   */
  test('gives a guest the waiting room rather than the host’s work surface', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby&as=p2')

    // The card names itself for what a waiting player is looking at, and the
    // roster carries the count rather than the host's "5 of 10" capacity.
    await expect(page.getByRole('heading', { name: /You’re in, / })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'In the room' })).toBeVisible()
    await expect(page.getByText('5 players')).toBeVisible()

    // The rules the host set, read-only — the same four pairs, in order.
    for (const label of ['Rounds', 'Caption time', 'Format', 'Voting']) {
      await expect(page.getByRole('term').filter({ hasText: label })).toBeVisible()
    }
    await expect(page.getByRole('definition').filter({ hasText: '90 sec' })).toBeVisible()
  })

  test('centres the guest column rather than stacking it against one edge', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby&as=p2')

    // The bug this replaces: a guest read the host's two-column layout with
    // its left-hand column empty, so the whole screen sat hard left.
    //
    // Measured against each other rather than against `main`: below `md` the
    // content column is padded asymmetrically to clear the floating toolbox,
    // so its border box's midpoint is 9px off the midpoint anything inside it
    // is centred on. What the layout actually claims is that these three
    // share one centre line.
    const heading = await page.getByRole('heading', { name: /You’re in, / }).boundingBox()
    const card = await page.getByRole('heading', { name: 'In the room' }).boundingBox()
    // The pill itself, not its label: the label sits right of the waiting dot,
    // so its own midpoint is half a dot off the pill's.
    const status = await page
      .getByText('Waiting on the host to start')
      .locator('xpath=..')
      .boundingBox()
    for (const box of [heading, card, status]) expect(box).not.toBeNull()

    const mid = (box: { x: number; width: number } | null) => (box?.x ?? 0) + (box?.width ?? 0) / 2
    expect(Math.abs(mid(heading) - mid(status))).toBeLessThanOrEqual(2)
    // And the card under them is a block they sit centred over, not a column
    // they are aligned to the left edge of.
    expect(card?.x ?? 0).toBeLessThan(mid(heading))
  })

  test('blocks the start without disabling it, and says why out loud', async ({ page }) => {
    // A bare room: just the host, two short of the minimum.
    await page.goto('/room/DEV?seed=42')

    const start = page.getByRole('button', { name: 'Start game — need 2 more' })
    await expect(start).toBeVisible()
    // Blocked is not disabled: it stays clickable and focusable.
    await expect(start).not.toBeDisabled()
    await start.focus()
    await expect(start).toBeFocused()

    await start.click()

    // The whole refusal path in one assertion: the intent goes over the
    // transport, the host authorises it, refuses, and the reason comes back as
    // `authorize`'s own sentence.
    await expect(page.getByRole('status')).toHaveText('Need 2 more players.')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
  })
})
