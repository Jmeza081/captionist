import { expect, test, type Page } from '@playwright/test'

// Selector policy: getByRole > data-testid > CSS. Never target hashed
// `.module.scss` class names — they change on every build.

/**
 * Six refinements that share no feature between them but do share one theme:
 * a control that did not look like one, or did the laptop's thing on a phone.
 */

/** A room whose lobby is the host's, which is the only one with a share block. */
const ROOM = '/room/DEV?seed=42&phase=lobby'

test.describe('the close key', () => {
  test('is a filled disc with a target you can hit', async ({ page }) => {
    await page.goto(ROOM)
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const close = page
      .getByRole('dialog', { name: 'How Captionist works' })
      .getByRole('button', { name: 'Close' })
    await expect(close).toBeVisible()

    // The affordance itself: a filled circle the size of the app's other round
    // keys, with a target bigger than the plate so the touch minimum survives
    // the smaller drawing. Read off computed style rather than a class name,
    // which is hashed.
    const box = (await close.boundingBox())!
    expect(box.width).toBe(36)
    expect(box.height).toBe(36)
    expect(await close.evaluate((el) => getComputedStyle(el, '::after').width)).toBe('44px')
    expect(await close.evaluate((el) => getComputedStyle(el, '::after').height)).toBe('44px')
    await expect(close).toHaveCSS('border-radius', '50%')
    // Not `transparent` and not `none` — a plate rather than a bare glyph.
    const fill = await close.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(fill).not.toBe('rgba(0, 0, 0, 0)')

    // And it still does the one thing it is for.
    await close.click()
    await expect(page.getByRole('dialog', { name: 'How Captionist works' })).toHaveCount(0)
  })

  test('is the same round key as the one in the bar above it', async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 768,
      'the sheet and the app header only stack on a phone',
    )
    await page.goto(ROOM)
    await page.getByRole('button', { name: /^Open chat/ }).click()

    const help = await page
      .getByRole('button', { name: 'How Captionist works' })
      .boundingBox()
    const close = await page
      .getByRole('complementary', { name: 'Room chat', exact: true })
      .getByRole('button', { name: 'Close chat' })
      .boundingBox()

    // Two round keys in a column, so they share a size and an edge. It was a
    // 44px disc at a 16px inset under a 36px key at a 20px one.
    expect(close!.width).toBeCloseTo(help!.width, 0)
    expect(close!.x + close!.width).toBeCloseTo(help!.x + help!.width, 0)

    // The plate shrank; the target did not.
    const target = await page
      .getByRole('complementary', { name: 'Room chat', exact: true })
      .getByRole('button', { name: 'Close chat' })
      .evaluate((el) => getComputedStyle(el, '::after').width)
    expect(target).toBe('44px')
  })

  test('draws a heavier × than the glyph carries on its own', async ({ page }) => {
    await page.goto(ROOM)
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const stroke = await page
      .getByRole('dialog', { name: 'How Captionist works' })
      .getByRole('button', { name: 'Close' })
      .locator('svg')
      .getAttribute('stroke-width')

    // 2.2 is the design's own weight for `close`, which is what this replaced.
    expect(Number(stroke)).toBeGreaterThan(2.2)
  })
})

test.describe('the walkthrough’s pictures', () => {
  test('draws a picture in every step of the rail', async ({ page }) => {
    // The suite runs stubbed, so what renders here is the committed SVG the
    // real GIF replaces in production. That is the case worth guarding: the
    // fallback is what a keyless clone and this suite both keep.
    await page.goto(ROOM)
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    const rail = dialog.getByTestId('modal-rail')

    for (const step of ['Next', 'Next', 'Next']) {
      await expect(rail.locator('img').first()).toHaveJSProperty('complete', true)
      await dialog.getByRole('button', { name: step }).click()
    }
  })

  test('ranks four captions over one image, and four GIFs over none', async ({ page }) => {
    await page.goto(ROOM)
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    const rail = dialog.getByTestId('modal-rail')
    const toVote = async () => {
      await dialog.getByRole('button', { name: 'Next' }).click()
      await dialog.getByRole('button', { name: 'Next' }).click()
      await expect(dialog.getByText('The room ranks the top three')).toBeVisible()
    }

    // Caption mode: the Captionist picks ONE image and everybody writes over
    // that same image, so four different pictures here would teach the other
    // format to the person reading the walkthrough to learn this one.
    await toVote()
    const captioned = await rail.locator('img').evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src),
    )
    expect(captioned).toHaveLength(4)
    expect(new Set(captioned).size).toBe(1)
    await expect(rail.getByText('Works on my machine')).toBeVisible()

    // React mode: four answers are four GIFs, and none of them carries words.
    await dialog.getByRole('radio', { name: 'React to the caption' }).click()
    await toVote()
    const answered = await rail.locator('img').evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src),
    )
    expect(answered).toHaveLength(4)
    expect(new Set(answered).size).toBe(4)
    await expect(rail.getByText('Works on my machine')).toHaveCount(0)
  })
})

test.describe('the walkthrough’s caption step', () => {
  test('does not repeat the bottom line in a composer under it', async ({ page }) => {
    await page.goto(ROOM)
    await page.getByRole('button', { name: 'How Captionist works' }).click()

    const dialog = page.getByRole('dialog', { name: 'How Captionist works' })
    await dialog.getByRole('button', { name: 'Next' }).click()
    await expect(dialog.getByText('Everyone else captions it')).toBeVisible()

    const rail = dialog.getByTestId('modal-rail')
    // Both meme lines stay — they are what the step is demonstrating.
    await expect(rail.getByText('Prod’s down again')).toBeVisible()
    await expect(rail.getByText('And I’m on call')).toHaveCount(1)
    // The composer strip under them is gone: it was a third copy of the bottom
    // line, over a clock nothing in this step is counting.
    await expect(rail.getByText('0:41')).toHaveCount(0)
  })
})

test.describe('the host’s toolbox', () => {
  test('holds back the controls a lobby has nothing to point at', async ({ page }) => {
    await page.goto(ROOM)
    await page.getByRole('button', { name: /toolbox$/i }).first().click()

    const box = page.getByRole('region', { name: 'Host toolbox' })
    await expect(box).toBeVisible()

    // The engine allows all of these in every phase and quietly no-ops most of
    // them outside a running round, which is what left a lobby with a Pause key
    // for a clock reading 0:00.
    const held = ['Pause', 'Skip ahead', 'Force a tie', 'Jump to final', 'Restart game']
    for (const name of held) {
      const key = box.getByRole('button', { name, exact: true })
      await expect(key).toHaveClass(/blocked/)
      // Blocked is not disabled: it stays live and focusable (CLAUDE.md 10).
      await expect(key).not.toBeDisabled()
    }

    // What still applies here does not get tinted with them.
    for (const name of ['Switch to prompts', 'How this works']) {
      await expect(box.getByRole('button', { name, exact: true })).not.toHaveClass(/blocked/)
    }

    // One line for the group rather than six labels narrating an empty state.
    await expect(box.getByText('Round controls wake up once the game starts.')).toBeVisible()
  })

  test('lets them all through once a round is running', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote')
    await page.getByRole('button', { name: /toolbox$/i }).first().click()

    const box = page.getByRole('region', { name: 'Host toolbox' })
    for (const name of ['Pause', 'Skip ahead', 'Force a tie', 'Jump to final', 'Restart game']) {
      await expect(box.getByRole('button', { name, exact: true })).not.toHaveClass(/blocked/)
    }
    await expect(box.getByText('Round controls wake up')).toHaveCount(0)
  })
})

test.describe('a refusal', () => {
  test('wears a warning rather than the tick that means it worked', async ({ page }) => {
    // A room the host actually cannot start, which the fixtures are not.
    await page.goto('/host')
    await page.getByRole('button', { name: 'Open the room' }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    await page.getByRole('button', { name: /Start game/ }).click()

    const bar = page.getByRole('status')
    await expect(bar).toHaveText(/Need \d+ more player/)
    // The room saying no is announced assertively and marked as a warning; the
    // green tick is reserved for a thing you did that worked.
    await expect(bar).toHaveAttribute('aria-live', 'assertive')
    await expect(bar).toHaveClass(/warning/)
  })
})

test.describe('a room announcement with chat shut', () => {
  test('clears the floating corner instead of hiding behind it', async ({ page }) => {
    await page.goto(ROOM)

    const close = page.getByRole('button', { name: 'Close chat' })
    if (await close.count()) await close.first().click()
    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()

    // The host engine announces a mode change to the whole room, and with the
    // rail shut it arrives in the toast lane — which used to land underneath
    // the toolbox key, readable only once a second one had stacked above it.
    await page.getByRole('radio', { name: 'React to the caption' }).click()
    // Scoped to the collapsed strip, which is where a toast lives. The rail
    // that just closed is still mounted for the length of its slide out, and
    // its log carries the same announcement — so an unscoped text match races
    // the exit animation rather than testing anything.
    const toast = page
      .getByRole('complementary', { name: 'Room chat, collapsed' })
      .getByText('New mode: React to the caption.')
    await expect(toast).toBeVisible()

    const dock = (await toast.boundingBox())!
    const overlaps = async (name: RegExp) => {
      const key = await page.getByRole('button', { name }).first().boundingBox()
      if (!key) return false
      return (
        dock.x < key.x + key.width &&
        key.x < dock.x + dock.width &&
        dock.y < key.y + key.height &&
        key.y < dock.y + dock.height
      )
    }

    expect(await overlaps(/toolbox$/i)).toBe(false)
    expect(await overlaps(/^Open chat/)).toBe(false)
  })
})

test.describe('the toolbox key', () => {
  test('opens behind a toolbox rather than a reaction face', async ({ page }) => {
    await page.goto(ROOM)

    const fab = page.getByRole('button', { name: /toolbox$/i }).first()
    await expect(fab).toBeVisible()

    // The smiley is the app's reaction affordance on every other surface, so
    // the one control that is a bar of tools must not wear it. Both glyphs are
    // traced paths; the toolbox is the only one drawn from four of them.
    const paths = await fab.locator('svg path').count()
    expect(paths).toBe(4)
    // A smiley is a circle plus a path; a toolbox has no circle at all.
    expect(await fab.locator('svg circle').count()).toBe(0)
  })
})

test.describe('sharing a room', () => {
  test('opens the device’s share sheet where there is one', async ({ page }) => {
    // Stand in for the OS sheet, and record what it was handed.
    await page.addInitScript(() => {
      const shared: unknown[] = []
      ;(window as unknown as { __shared: unknown[] }).__shared = shared
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (data: unknown) => {
          shared.push(data)
          return Promise.resolve()
        },
      })
    })
    await page.goto(ROOM)

    // The label follows what the device will actually do: the sheet lists
    // everything installed, and Slack is one row of it.
    const key = page.getByRole('button', { name: 'Share link' })
    await expect(key).toBeVisible()
    await expect(page.getByRole('button', { name: 'Share to Slack' })).toHaveCount(0)

    await key.click()
    const shared = await page.evaluate(
      () => (window as unknown as { __shared: { url?: string }[] }).__shared,
    )
    expect(shared).toHaveLength(1)
    // `DEV` resolves to a real room code, so what is shared is the room's own
    // join link rather than the URL that opened it.
    expect(shared[0]?.url).toMatch(/\/join\/C-[0-9A-Z]{6}$/)

    // The sheet is the visible result. A snackbar under it would be the room
    // confirming the thing that is covering the room.
    await expect(page.getByText('Link copied — paste it into Slack')).toHaveCount(0)
  })

  test('falls back to the clipboard, and says so, where there is not', async ({
    context,
    page,
  }) => {
    // The write is awaited now — a room that says "copied" over a rejected
    // write is lying — so the runner has to be allowed to make one.
    await context.grantPermissions(['clipboard-write'])
    await page.addInitScript(() => {
      // Some browsers ship `share` on the desktop build; take it away so this
      // is the no-sheet case whatever the runner has.
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    })
    await page.goto(ROOM)

    await expect(page.getByRole('button', { name: 'Share to Slack' })).toBeVisible()
    await page.getByRole('button', { name: 'Share to Slack' }).click()
    await expect(page.getByText('Link copied — paste it into Slack')).toBeVisible()
  })
})

test.describe('licensing', () => {
  test('is one click from the front door', async ({ page }) => {
    await page.goto('/')

    // One link in the foot, and it is not the repository: the nav already
    // carries that, and two links to one destination on one screen is a reader
    // wondering what the difference is.
    const foot = page.getByRole('contentinfo')
    await expect(foot.getByRole('button')).toHaveCount(1)
    await expect(foot.getByRole('link')).toHaveCount(0)

    await page.getByRole('button', { name: 'Licensing and credits' }).click()
    const dialog = page.getByRole('dialog', { name: 'Licensing and credits' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Captionist is MIT')

    // Four obligations to four parties, and every one of them is readable.
    await dialog.getByRole('button', { name: 'Next' }).click()
    await expect(
      dialog.getByRole('link', { name: 'KLIPY', exact: true }),
    ).toHaveAttribute('href', /klipy\.com/)
    // The provider's own terms, not just its home page.
    await expect(dialog.getByRole('link', { name: 'KLIPY’s' })).toHaveAttribute(
      'href',
      /klipy\.com\/terms/,
    )

    await dialog.getByRole('button', { name: 'Next' }).click()
    await expect(dialog.getByRole('link', { name: 'CC0 1.0' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Next' }).click()
    await expect(dialog.getByRole('link', { name: 'CC BY 4.0' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Inter' })).toBeVisible()

    // The last step's key closes rather than advancing into nothing.
    await dialog.getByRole('button', { name: 'Got it' }).click()
    await expect(dialog).toHaveCount(0)
  })
})

/** The sheet's own height, which is what the handle changes. */
async function sheetHeight(page: Page): Promise<number> {
  const box = await page.getByRole('complementary', { name: 'Room chat' }).boundingBox()
  return box!.height
}

/**
 * Wait for the sheet to finish arriving.
 *
 * `boundingBox()` reports where a thing *is*, so a box read mid-slide is the
 * handle's position 200ms ago — and a raw `page.mouse.down()` at that point
 * lands on the room behind it. Playwright's own `click()` waits for a stable
 * box on its own; only a hand-driven pointer has to ask.
 */
async function settled(page: Page): Promise<void> {
  await page
    .getByRole('complementary', { name: 'Room chat', exact: true })
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
}

test.describe('chat’s arrival', () => {
  test('leaves at both sizes, and is inert on the way out', async ({ page }) => {
    await page.goto(ROOM)
    const open = page.getByRole('button', { name: /^Open chat/ })
    if (await open.count()) await open.click()
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()

    await page.getByRole('button', { name: 'Close chat' }).click()

    // The key it collapses into is there at once — nothing waits on the slide.
    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()
    // And the panel is still in the document, sliding, and inert while it does
    // it: something halfway off the screen must not be tabbable and must not
    // announce a second "Room chat". On a desk it is also out of flow, or it
    // would be a second column standing beside the collapsed strip.
    await expect(page.locator('aside[inert]')).toHaveCount(1)
    await expect(
      page.getByRole('complementary', { name: 'Room chat', exact: true }),
    ).toHaveCount(0)

    // Then it goes, rather than lingering as an invisible overlay.
    await expect(page.locator('aside[inert]')).toHaveCount(0)
  })
})

test.describe('the chat sheet’s arrival', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'the docked rail does not slide')

  test('stays on screen long enough to be seen leaving', async ({ page }) => {
    await page.goto(ROOM)
    await page.getByRole('button', { name: /^Open chat/ }).click()
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()

    await page.getByRole('button', { name: 'Close chat' }).click()

    // The key it collapses into is there at once — nothing waits on the slide.
    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()
    // And the sheet is still in the document, sliding, and inert while it does
    // it: a panel halfway off the screen must not be tabbable and must not
    // announce a second "Room chat".
    await expect(page.locator('aside[inert]')).toHaveCount(1)
    await expect(
      page.getByRole('complementary', { name: 'Room chat', exact: true }),
    ).toHaveCount(0)

    // Then it goes, rather than lingering as an invisible overlay.
    await expect(page.locator('aside[inert]')).toHaveCount(0)
  })
})

test.describe('the chat sheet’s handle', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'the docked rail is not dragged')

  test('resizes on a tap and closes on a second one', async ({ page }) => {
    await page.goto(ROOM)
    await page.getByRole('button', { name: /^Open chat/ }).click()
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()

    const tall = await sheetHeight(page)

    // The handle is a control, not a bar with a listener bolted on: it is
    // reachable, it is named, and it works without a pointer gesture at all.
    const handle = page.getByRole('button', { name: /drag to resize$/ })
    await expect(handle).toBeVisible()
    await handle.click()

    await expect(async () => {
      expect(await sheetHeight(page)).toBeLessThan(tall - 40)
    }).toPass()
    // And it says which way it will go next.
    await expect(page.getByRole('button', { name: /^Expand chat/ })).toBeVisible()

    await page.getByRole('button', { name: /^Expand chat/ }).click()
    await expect(async () => {
      expect(await sheetHeight(page)).toBeGreaterThan(tall - 10)
    }).toPass()
  })

  test('shrinks on a drag down, and dismisses on the next one', async ({ page }) => {
    await page.goto(ROOM)
    await page.getByRole('button', { name: /^Open chat/ }).click()
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()

    await settled(page)
    const tall = await sheetHeight(page)
    const handle = page.getByRole('button', { name: /drag to resize$/ })
    const grip = (await handle.boundingBox())!
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }

    const dragDown = async (distance: number) => {
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      // Several steps, because one jump is a teleport rather than a drag and
      // never fires the moves the sheet follows.
      for (let i = 1; i <= 6; i += 1) {
        await page.mouse.move(from.x, from.y + (distance * i) / 6)
      }
      await page.mouse.up()
    }

    await dragDown(Math.round(tall * 0.4))
    await expect(async () => {
      expect(await sheetHeight(page)).toBeLessThan(tall - 40)
    }).toPass()

    // A second drag from the short detent is the one that throws it away.
    const short = (await handle.boundingBox())!
    const shortFrom = { x: short.x + short.width / 2, y: short.y + short.height / 2 }
    await page.mouse.move(shortFrom.x, shortFrom.y)
    await page.mouse.down()
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(shortFrom.x, shortFrom.y + (200 * i) / 6)
    }
    await page.mouse.up()

    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()
  })
})
