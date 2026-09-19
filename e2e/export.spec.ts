import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * The export keys: a meme out of the reveal and the vote, a picture of the
 * standings out of the score screen and the podium.
 *
 * Every source under the suite is the offline shelf's SVG — the runner blocks
 * every host but loopback — so what these exercise is the one-frame road
 * through the renderer, the delivery by capability, and the flag. The GIF
 * decode itself is checked by hand against a live provider (ADR 0036).
 */

const REVEAL = '/room/C-E10001?seed=42&phase=reveal&gifs=stub'
const REVEAL_REACT = '/room/C-E10002?seed=42&phase=reveal&mode=react&gifs=stub'
const REVEAL_GUEST = '/room/C-E10003?seed=42&phase=reveal&as=p2&gifs=stub'
const VOTE = '/room/C-E10004?seed=42&phase=vote&as=p2&gifs=stub'
const SCORE = '/room/C-E10005?seed=42&phase=score&gifs=stub'
const PODIUM = '/room/C-E10006?seed=42&phase=podium&gifs=stub'

interface Shared {
  name: string
  type: string
  size: number
}

declare global {
  interface Window {
    __shared?: Shared[]
  }
}

/** A share sheet that takes files, and records what it was handed. */
async function sheetWithFiles(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shared: Shared[] = []
    window.__shared = shared
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: { files?: File[] }) => Boolean(data.files && data.files.length > 0),
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data: { files?: File[] }) => {
        for (const f of data.files ?? []) shared.push({ name: f.name, type: f.type, size: f.size })
        return Promise.resolve()
      },
    })
  })
}

/** No sheet at all — the laptop. */
async function noSheet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined })
  })
}

/** A laptop whose clipboard cannot take an image either. */
async function noClipboardImage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: undefined })
  })
}

const sharedFiles = (page: Page) => page.evaluate(() => window.__shared ?? [])

/**
 * Exactly one file reached the sheet.
 *
 * Not `expect.poll(...).toHaveLength(1)`: that succeeds the instant the array
 * first reaches one and never looks again, so a second `share()` landing a
 * beat later was invisible to every test here — which is the shape of the
 * "duplicate share image" report, and the suite could not have caught it.
 * Wait for the first, give a second one room to arrive, then count.
 */
async function expectSharedOnce(page: Page): Promise<Shared> {
  await expect.poll(() => sharedFiles(page)).toHaveLength(1)
  await page.waitForTimeout(500)
  const files = await sharedFiles(page)
  expect(files).toHaveLength(1)
  const [file] = files
  if (!file) throw new Error('unreachable: one file was just counted')
  return file
}

async function grantClipboard(context: BrowserContext): Promise<void> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
}

test.describe('exporting the winning meme', () => {
  test('hands the share sheet a GIF where the sheet takes files, and says nothing', async ({
    page,
  }) => {
    await sheetWithFiles(page)
    await page.goto(REVEAL)

    const key = page.getByRole('button', { name: 'Share GIF' })
    await expect(key).toBeVisible()
    await key.click()

    const file = await expectSharedOnce(page)
    expect(file?.name).toBe('captionist-round-1.gif')
    expect(file?.type).toBe('image/gif')
    expect(file?.size).toBeGreaterThan(200)
    // The sheet is the visible result; a snackbar under it is the room talking
    // over the thing that is covering it.
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('saves the GIF where there is no sheet, and says so', async ({ page }) => {
    await noSheet(page)
    await page.goto(REVEAL)

    const key = page.getByRole('button', { name: 'Save GIF' })
    await expect(key).toBeVisible()
    await expect(page.getByRole('button', { name: 'Share GIF' })).toHaveCount(0)

    const [download] = await Promise.all([page.waitForEvent('download'), key.click()])
    expect(download.suggestedFilename()).toBe('captionist-round-1.gif')
    const path = await download.path()
    expect(path).toBeTruthy()
    const { size } = await import('node:fs').then((fs) => fs.promises.stat(path))
    expect(size).toBeGreaterThan(200)
    await expect(page.getByRole('status')).toHaveText('GIF saved')
  })

  test('is offered in react mode too, where the prompt rides above the picture', async ({
    page,
  }) => {
    await sheetWithFiles(page)
    await page.goto(REVEAL_REACT)
    await page.getByRole('button', { name: 'Share GIF' }).click()
    expect((await expectSharedOnce(page)).type).toBe('image/gif')
  })

  test('is a guest’s to take as much as the host’s', async ({ page }) => {
    await noSheet(page)
    await page.goto(REVEAL_GUEST)
    await expect(page.getByRole('button', { name: 'Save GIF' })).toBeVisible()
    // The guest has no advance button; the key does not stand in for one.
    await expect(page.getByRole('button', { name: 'See the scoreboard' })).toHaveCount(0)
  })

  test('is keyboard-reachable and fires on Enter', async ({ page }) => {
    await sheetWithFiles(page)
    await page.goto(REVEAL)
    const key = page.getByRole('button', { name: 'Share GIF' })
    await expect(key).toBeVisible()
    await key.focus()
    await expect(key).toBeFocused()
    await page.keyboard.press('Enter')
    await expectSharedOnce(page)
  })

  test('paints the first frame the same on both visits', async ({ page }) => {
    // The server cannot detect a sheet, so the first paint wears the laptop's
    // word and the client corrects it before anyone reads it. What must not
    // happen is React complaining that the two disagreed.
    const hydration: string[] = []
    page.on('console', (m) => {
      if (/hydrat/i.test(m.text())) hydration.push(m.text())
    })
    await noSheet(page)
    await page.goto(REVEAL)
    await expect(page.getByRole('button', { name: 'Save GIF' })).toBeVisible()
    expect(hydration).toEqual([])
  })
})

test.describe('exporting a card from the vote', () => {
  test('every card has its own key, named for the card, and none names an author', async ({
    page,
  }) => {
    await sheetWithFiles(page)
    await page.goto(VOTE)

    const keys = page.getByRole('button', { name: /^Share .* as a GIF$/ })
    await expect(keys).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Share entry 1 as a GIF' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Share your answer as a GIF' })).toBeVisible()

    await page.getByRole('button', { name: 'Share entry 2 as a GIF' }).click()
    const file = await expectSharedOnce(page)
    expect(file?.name).toBe('captionist-round-1-entry-2.gif')
    expect(file?.type).toBe('image/gif')
  })
})

test.describe('exporting the standings', () => {
  test('copies a PNG to the clipboard on a laptop, and says where to paste it', async ({
    context,
    page,
  }) => {
    await grantClipboard(context)
    await noSheet(page)
    await page.goto(SCORE)

    const key = page.getByRole('button', { name: 'Copy image' })
    await expect(key).toBeVisible()
    await key.click()
    await expect(page.getByRole('status')).toHaveText('Image copied — paste it into Slack')

    const types = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read()
      return item?.types ?? []
    })
    expect(types).toContain('image/png')
  })

  test('saves the PNG where the clipboard cannot take an image', async ({ page }) => {
    await noSheet(page)
    await noClipboardImage(page)
    await page.goto(SCORE)

    const key = page.getByRole('button', { name: 'Save image' })
    await expect(key).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download'), key.click()])
    expect(download.suggestedFilename()).toMatch(/^captionist-standings-C-[0-9A-Z]{6}\.png$/)
    await expect(page.getByRole('status')).toHaveText('Image saved')
  })

  test('is the podium’s third pill, after the way out, for everyone', async ({ page }) => {
    await sheetWithFiles(page)
    await page.goto(PODIUM)

    const pills = page.locator('main[data-phase] button, main[data-phase] a').filter({
      hasText: /Rematch|Back to the start|Share image/,
    })
    await expect(pills).toHaveText([/Rematch/, 'Back to the start', 'Share image'])

    await page.getByRole('button', { name: 'Share image' }).click()
    expect((await expectSharedOnce(page)).type).toBe('image/png')

    await page.goto(`${PODIUM}&as=p2`)
    await expect(page.getByRole('button', { name: 'Share image' })).toBeVisible()
  })
})

test.describe('the export flag', () => {
  test('off, no screen offers a key and nothing else moves', async ({ page }) => {
    await sheetWithFiles(page)
    for (const url of [REVEAL, VOTE, SCORE, PODIUM]) {
      await page.goto(`${url}&export=off`)
      await expect(page.locator('main[data-phase]')).toBeVisible()
      // Not `/GIF/`: the desktop's chat rail has an "Attach a GIF" of its own.
      await expect(
        page.getByRole('button', { name: /^(Share|Save|Copy|Send) (GIF|image)$|as a GIF$/ }),
      ).toHaveCount(0)
    }
    // The podium's row is what it was before the key existed.
    const pills = page.locator('main[data-phase] button, main[data-phase] a').filter({
      hasText: /Rematch|Back to the start|Share image/,
    })
    await expect(pills).toHaveText([/Rematch/, 'Back to the start'])
  })
})
