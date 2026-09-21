import { expect, test, type Page } from '@playwright/test'

// Selector policy: getByRole > data-testid > CSS. Never target hashed classes.

/**
 * The host's pause key.
 *
 * `host/paused` has worked since phase 1; what is new is reaching it without
 * opening a drawer, and the clock admitting it has stopped. The second half is
 * the one that was a bug: a paused 0:24 and a running 0:24 used to be
 * identical, which is the "timers are honest" rule the reveal's dropped
 * "auto-advancing in 6s" label was also about.
 */
const timer = (page: Page) => page.getByRole('timer')

/**
 * `xl` is 1280px — the hint needs both a keyboard and a header with room in
 * it, and below `xl` the settings line and the clock already fill that row.
 */
function showsHint(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1280
}

/** Whatever shape chat is in, leave it with the composer focusable. */
async function openChat(page: Page): Promise<void> {
  const composer = page.getByRole('textbox', { name: 'Message the room' })
  const key = page.getByRole('button', { name: /^Open chat/ })
  await expect(composer.or(key).first()).toBeVisible()
  if (await key.count()) await key.click()
  await expect(composer).toBeVisible()
}

/** Alt+P, as a physical key. On macOS the character would be π. */
async function pressPause(page: Page) {
  await page.keyboard.press('Alt+KeyP')
}

test.describe('the pause shortcut', () => {
  test('holds the clock, and the clock says so', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&gifs=stub')
    await expect(timer(page)).toBeVisible()
    await expect(timer(page)).not.toContainText('paused')

    await pressPause(page)

    // The whole point: the number stops *and* looks stopped.
    await expect(timer(page)).toContainText('paused')

    // And it really is held — a running clock would have moved on by now.
    const held = await timer(page).textContent()
    await page.waitForTimeout(1_200)
    expect(await timer(page).textContent()).toBe(held)
  })

  test('resumes on a second press', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&gifs=stub')
    // The listener binds once the room has state, so the clock being on screen
    // is the signal there is something to press against.
    await expect(timer(page)).toBeVisible()
    await pressPause(page)
    await expect(timer(page)).toContainText('paused')

    await pressPause(page)
    await expect(timer(page)).not.toContainText('paused')
  })

  test('keeps its hands off the round while somebody is typing', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&gifs=stub')

    await expect(timer(page)).toBeVisible()

    // The room is full of text fields, and P is a letter. Pausing the game
    // because a caption contained one would be the worst kind of surprise.
    // Chat is docked on a desk and a sheet on a phone; either way it ends
    // with a focused composer, which is the only part that matters here.
    await openChat(page)
    await page.getByRole('textbox', { name: 'Message the room' }).click()
    await pressPause(page)

    await expect(timer(page)).not.toContainText('paused')
  })

  test('is the host’s alone', async ({ page }) => {
    // A guest pressing it must change nothing: `host/paused` is host-only, so
    // a guest's press could at best produce a refusal snackbar.
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')
    await expect(timer(page)).toBeVisible()

    await pressPause(page)
    await expect(timer(page)).not.toContainText('paused')
  })
})

test.describe('the shortcut hint', () => {
  test('names the key beside the clock, and flips with the state', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&gifs=stub')
    await expect(timer(page)).toBeVisible()

    const hint = page.getByText(/^Press Alt plus P to (pause|resume)$/)

    // A phone has no keys to press, so it is offered none. Two gates, both
    // necessary: `useHasKeyboard` asks `(hover: hover) and (pointer: fine)`,
    // because a host in landscape has a wide screen and no keyboard — and the
    // stylesheet asks for `xl`, because a narrow laptop window has a keyboard
    // and no room.
    if (!showsHint(page)) {
      await expect(hint).toHaveCount(0)
      return
    }

    // Written as a sentence for assistive tech — two keycaps read aloud as
    // "⌥, P" teach nobody anything.
    await expect(hint).toHaveCount(1)
    await expect(hint).toContainText('pause')

    await pressPause(page)
    await expect(page.getByText(/^Press Alt plus P to resume$/)).toHaveCount(1)
  })

  test('is not offered to a guest, who cannot press it', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')
    await expect(timer(page)).toBeVisible()
    await expect(page.getByText(/^Press Alt plus P to /)).toHaveCount(0)
  })

  test('goes away with the clock it explains', async ({ page }) => {
    // The scoreboard is host-paced and has no clock, so a key that would do
    // nothing is not advertised.
    await page.goto('/room/DEV?seed=42&phase=score&gifs=stub')
    await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
    await expect(page.getByText(/^Press Alt plus P to /)).toHaveCount(0)
  })
})
