import { expect, test } from '@playwright/test'

/**
 * The imported Noto catalog.
 *
 * 584 emoji whose glyph is a committed, same-origin still, with the animation
 * layered from Google's CDN at runtime. The suite resolves no host but the dev
 * server, so every assertion here is the floor rather than the happy path: the
 * room is fully usable on the stills alone, with the CDN unreachable.
 */

/** A tile from the imported catalog, as opposed to authored or Giphy art. */
const CATALOG_TILE = 'img[src^="/media/emoji/"]'

/** The picker's page size. A pack arrives as fast as it is scrolled. */
const PAGE = 60

test.describe('the reaction catalog', () => {
  // The picker is a molecule, and the gallery mounts one tier at a time — so
  // the toolbar is reached by its section's deep link rather than by loading
  // the whole library.
  test('fills a pack a page at a time', async ({ page }) => {
    await page.goto('/components#chat')

    const toolbar = page.getByRole('dialog', { name: 'React to this caption' })
    const tiles = toolbar.getByRole('group', { name: 'Reactions' }).getByRole('button')

    // The default grid is untouched by the import: §4.4's 6 emoji + 4 Slackmojis.
    await expect(tiles).toHaveCount(10)

    await toolbar.getByRole('button', { name: 'Nature' }).click()
    // A page, not all 182. The packs used to render whole, which was fine at
    // fourteen tiles and is a stall at this size.
    await expect(tiles).toHaveCount(PAGE)
    await expect(tiles.locator(CATALOG_TILE).first()).toBeVisible()

    // Reaching the bottom reaches the sentinel, which asks for the next page.
    await tiles.last().scrollIntoViewIfNeeded()
    await expect.poll(() => tiles.count()).toBeGreaterThan(PAGE)
  })

  test('renders its stills with the CDN unreachable', async ({ page }) => {
    await page.goto('/components#chat')

    const toolbar = page.getByRole('dialog', { name: 'React to this caption' })
    await toolbar.getByRole('button', { name: 'Nature' }).click()

    // Every tile is same-origin. If the animation were assigned to `src`
    // directly rather than swapped in after it decodes, these would be broken
    // images right now instead of emoji.
    const first = toolbar.getByRole('group', { name: 'Reactions' }).locator(CATALOG_TILE).first()
    await expect(first).toBeVisible()

    // Decoded, not merely present. A broken image is visible too — and if the
    // animation were assigned to `src` directly rather than swapped in after it
    // loads, that is exactly what this would be with the CDN blocked.
    await expect
      .poll(() => first.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0)
  })

  test('is reachable by search, and names itself rather than its path', async ({ page }) => {
    await page.goto('/components#chat')

    const toolbar = page.getByRole('dialog', { name: 'React to this caption' })
    await toolbar.getByLabel('Search reactions').fill('penguin')

    const penguin = toolbar.getByRole('button', { name: 'Penguin', exact: true })
    await expect(penguin).toBeVisible()
    await expect(penguin.locator(CATALOG_TILE)).toHaveCount(1)
  })

  test('lands in a live tally as a picture, not a path', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')
    await expect(page.getByRole('heading', { name: 'Rank your top three.' })).toBeVisible()

    await page.getByRole('button', { name: 'Add a reaction' }).first().click()
    await page.getByLabel('Search reactions').fill('penguin')
    await page.getByRole('button', { name: 'Penguin', exact: true }).click()

    // The count reads as the room's, and the name is the catalog's. The bug
    // this guards is a tally rendering `/media/emoji/1f427.svg` as text, which
    // is what every surface did before `ReactionGlyph` existed.
    await expect(page.getByText('Penguin, 1 reaction, including yours')).toBeVisible()
    await expect(page.locator(`main ${CATALOG_TILE}`).first()).toBeVisible()
    await expect(page.getByText('/media/emoji/')).toHaveCount(0)
  })
})
