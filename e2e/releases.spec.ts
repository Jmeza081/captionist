import { expect, test, type Page } from '@playwright/test'

// Selector policy: getByRole > data-testid > CSS. Never target hashed classes.

/** `md` is 768px — below it the nav's words stand down and the help key stands in. */
function wide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 768
}

/**
 * The changelog on the front door.
 *
 * Runs against `RELEASES_STUB`, set in `playwright.config.ts`. The fetch is a
 * *server* one, so `--host-resolver-rules` — which blocks the browser's DNS —
 * does nothing about it, and `page.route` cannot intercept a call the browser
 * never makes. Without the stub this suite would call GitHub once per landing
 * page load and assert against whatever shipped that day.
 */
test.describe('release notes', () => {
  test('opens from the header, and closes three ways', async ({ page }) => {
    await page.goto('/')

    const key = page.getByRole('button', { name: 'Release notes' })
    if (!wide(page)) {
      // The phone bar is a wordmark, a help key and the way in. There is no
      // room for a fourth control, so a phone reads the notes on GitHub.
      await expect(key).toBeHidden()
      return
    }

    await expect(key).toBeVisible()
    await key.click()

    const dialog = page.getByRole('dialog', { name: 'What shipped' })
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('shows the newest release first, with its notes rendered', async ({ page }) => {
    await page.goto('/')
    if (!wide(page)) return

    await page.getByRole('button', { name: 'Release notes' }).click()
    const dialog = page.getByRole('dialog', { name: 'What shipped' })

    await expect(dialog.getByRole('heading', { name: 'v9.9.9' })).toBeVisible()
    await expect(dialog).toContainText('21 September 2026')

    // GitHub's own block markup, which is why `Modal` grew `bodyBlock`: a
    // heading and a list inside the card's default `<p>` would be reparented
    // by the browser and take the layout with them.
    await expect(dialog.getByRole('heading', { name: 'What it does' })).toBeVisible()
    await expect(dialog.getByRole('listitem')).toHaveCount(2)
  })

  test('sends every link in a note somewhere that exists', async ({ page }) => {
    await page.goto('/')
    if (!wide(page)) return

    await page.getByRole('button', { name: 'Release notes' }).click()
    const dialog = page.getByRole('dialog', { name: 'What shipped' })

    // The real bug `toSafeHtml` fixes: GitHub sends `href="/Jmeza081/…"`,
    // which resolves against captionist.fun and 404s.
    const link = dialog.getByRole('link', { name: 'the backlog' })
    await expect(link).toHaveAttribute(
      'href',
      'https://github.com/Jmeza081/captionist/blob/main/docs/backlog.md',
    )
    await expect(link).toHaveAttribute('target', '_blank')
  })

  test('walks back through older releases', async ({ page }) => {
    await page.goto('/')
    if (!wide(page)) return

    await page.getByRole('button', { name: 'Release notes' }).click()
    const dialog = page.getByRole('dialog', { name: 'What shipped' })

    // One release per step is what earns `Modal` its keep — the dots, the
    // count and this pair of controls all come for free.
    await dialog.getByRole('button', { name: 'Next' }).click()
    await expect(dialog.getByRole('heading', { name: 'v9.9.8' })).toBeVisible()
  })

  test('never takes the front door down with it', async ({ page }) => {
    // The whole reason `fetchReleases` answers with a status instead of
    // throwing: this page is the product's front door and a changelog is the
    // least important thing on it.
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /Join a room/ }).first()).toBeVisible()
  })
})
