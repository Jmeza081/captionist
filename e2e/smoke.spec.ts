import { expect, test } from '@playwright/test'

// Selector policy: getByRole > data-testid > CSS. Never target hashed
// `.module.scss` class names — they change on every build.

test.describe('join screen', () => {
  test('offers both ways into a room', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: 'Scan to join' })
    ).toBeVisible()

    // The QR is an <svg role="img"> titled for screen readers.
    await expect(page.getByRole('img', { name: /join room/i })).toBeVisible()

    // Scoped to the RoomCode atom: the QR's <title> also contains the code.
    await expect(page.getByTestId('room-code')).toContainText('C-F34213')
  })

  test('room code is announced to screen readers character by character', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText(/Room code: C - F 3 4 2 1 3/)).toBeAttached()
  })

  test('layout does not scroll horizontally', async ({ page }) => {
    await page.goto('/')

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    )
    expect(overflows).toBe(false)
  })

  test('captures the join screen', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Scan to join' })
    ).toBeVisible()

    // Attached to the HTML report and written to screenshots/ so a design
    // review can look at the real rendered screen, per viewport.
    const shot = await page.screenshot({ fullPage: true })
    await testInfo.attach(`join-${testInfo.project.name}`, {
      body: shot,
      contentType: 'image/png',
    })
  })
})
