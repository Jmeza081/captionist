import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Hats, from the picker to the roster to the crown.
 *
 * `playwright.config.ts` resolves every host but the dev server to nothing,
 * which makes `/media/hats/*.svg` same-origin and real — but it also means a
 * locator match is not proof the file exists, because a 404'd `<img>` still
 * matches. Anything asserting a hat is *drawn* checks `naturalWidth` too.
 */

/** The hat's own art, wherever it is drawn. */
const worn = (page: Page, id: string) => page.locator(`img[src="/media/hats/${id}.svg"]`)

/**
 * Waits for the file to actually decode, rather than sampling once.
 *
 * `toBeVisible` passes on a 404'd `<img>` — the element is there and laid out
 * — so this is the half that says the asset exists. Polled because a fresh
 * navigation can reach the assertion before the image has come back.
 */
async function expectDrawn(image: Locator): Promise<void> {
  await expect
    .poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true)
}

test.describe('picking a hat', () => {
  test('arrives folded, opens to the whole catalogue, and names what is worn', async ({
    page,
  }) => {
    await page.goto('/host')

    const grid = page.getByRole('radiogroup', { name: 'Host hat' })
    // Five offered plus "No hat" — exactly one row of six, because the second
    // picker on this card arrives folded and an orphan tile on a second row is
    // what the fold is avoiding.
    await expect(grid.getByRole('radio')).toHaveCount(6)
    await expect(grid.getByRole('radio', { name: 'No hat' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    const toggle = page.getByRole('button', { name: 'Show all hats' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()

    await expect(grid.getByRole('radio')).toHaveCount(17)
    await expect(page.getByRole('button', { name: 'Show fewer hats' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  test('draws the art it names, rather than a broken frame', async ({ page }) => {
    await page.goto('/host')
    await page.getByRole('radiogroup', { name: 'Host hat' }).getByRole('radio', {
      name: 'Viking helmet',
    }).click()

    // Named in the header, worn by the face previews above it, and actually
    // decoded — the three things that could each be true without the others.
    await expect(page.getByText('Viking helmet')).toBeVisible()
    const art = worn(page, 'viking').first()
    await expect(art).toBeVisible()
    await expectDrawn(art)
  })

  test('walks the grid with the arrow keys, selection following focus', async ({ page }) => {
    await page.goto('/host')
    const grid = page.getByRole('radiogroup', { name: 'Host hat' })

    await grid.getByRole('radio', { name: 'No hat' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(grid.getByRole('radio', { name: 'Party hat' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(grid.getByRole('radio', { name: 'Party hat' })).toBeFocused()

    // And back to bare-headed, which is a tile like any other rather than an
    // absence you have to find another way to express.
    await page.keyboard.press('ArrowLeft')
    await expect(grid.getByRole('radio', { name: 'No hat' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('remembers the hat, the way it remembers the face', async ({ page }) => {
    await page.goto('/join')
    const grid = page.getByRole('radiogroup', { name: 'Your hat' })
    await grid.getByRole('radio', { name: 'Traffic cone' }).click()

    await page.getByRole('textbox', { name: 'Room code' }).fill('F34213')
    await page.getByRole('button', { name: 'Join the room' }).click()
    await expect(page).toHaveURL(/\/room\//)

    await page.goto('/join')
    await expect(
      page.getByRole('radiogroup', { name: 'Your hat' }).getByRole('radio', {
        name: 'Traffic cone',
      }),
    ).toHaveAttribute('aria-checked', 'true')

    // And "No hat" genuinely clears it — the sentinel case. `undefined` means
    // bare-headed *and* untouched, so a naive `??` would fall straight back to
    // the stored hat and this tile would do nothing.
    await page.getByRole('radiogroup', { name: 'Your hat' }).getByRole('radio', {
      name: 'No hat',
    }).click()
    await page.getByRole('textbox', { name: 'Room code' }).fill('F34213')
    await page.getByRole('button', { name: 'Join the room' }).click()
    await expect(page).toHaveURL(/\/room\//)

    await page.goto('/join')
    await expect(
      page.getByRole('radiogroup', { name: 'Your hat' }).getByRole('radio', { name: 'No hat' }),
    ).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('wearing it', () => {
  test('rides into the room on the roster', async ({ page }) => {
    await page.goto('/host')
    // Deliberately one the folded window does not offer, so this also proves
    // a hat chosen from the open grid survives into the room.
    await page.getByRole('button', { name: 'Show all hats' }).click()
    await page.getByRole('radiogroup', { name: 'Host hat' }).getByRole('radio', {
      name: 'Wizard hat',
    }).click()
    await page.getByRole('button', { name: 'Open the room' }).click()

    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
    const art = worn(page, 'wizard').first()
    await expect(art).toBeVisible()
    await expectDrawn(art)
  })

  test('is not drawn where it would be a smudge', async ({ page }) => {
    // The gallery's eight-size row. 26px and 30px go bare — below that floor a
    // hat is three pixels of colour on a face already fighting for legibility.
    await page.goto('/components#identity')
    const sizes = page.locator('[data-testid="avatar-sizes"]')
    await expect(sizes.locator('img[src^="/media/hats/"]')).toHaveCount(6)
  })
})

test.describe('the crown', () => {
  test('goes to whoever is leading, over the hat they picked', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=score&as=p2&gifs=stub')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'score')

    const crown = worn(page, 'crown')
    await expect(crown).toHaveCount(1)
    await expectDrawn(crown.first())

    // On the leader, not merely somewhere on the page: the crowned avatar is
    // the one whose row also carries rank 1. A standings row is a `div`, so
    // this walks up from the art rather than guessing at a list element.
    const crownedRow = page.locator('main div', { has: crown }).last()
    await expect(crownedRow).toContainText('1')
    await expect(crownedRow.locator('img[src^="/media/hats/"]')).toHaveCount(1)
  })

  test('is nobody’s before anybody has scored', async ({ page }) => {
    // The *fixture* lobby: a fresh room holds only you, and you arrived
    // bare-headed, so there would be no hats to find either way.
    await page.goto('/room/DEV?seed=42&phase=lobby&gifs=stub')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    // The lobby roster is full of hats and none of them is the crown: at 0–0
    // `standings()` would hand rank 1 to whoever sorts first alphabetically,
    // and crowning them would be the scoreboard's tiebreak posing as a lead.
    await expect(page.locator('img[src^="/media/hats/"]').first()).toBeVisible()
    await expect(worn(page, 'crown')).toHaveCount(0)
  })
})
