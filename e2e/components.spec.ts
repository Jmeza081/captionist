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
      'Dropzone',
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

    // Unsearched, it shows the ten defaults — not the whole set.
    await expect(toolbar.getByRole('button')).toHaveCount(10)

    await toolbar.getByLabel('Search reactions').fill('outage')
    await expect(toolbar.getByRole('button', { name: 'Panic' })).toBeVisible()
    await expect(toolbar.getByRole('button')).toHaveCount(1)

    await toolbar.getByLabel('Search reactions').fill('zzzz')
    await expect(toolbar.getByText(/Nothing matches/)).toBeVisible()
  })

  test('the modal opens, steps, and closes on Escape', async ({ page }) => {
    await page.goto('/components')

    await page.getByRole('button', { name: 'Open the house rules' }).click()

    const modal = page.getByRole('dialog', { name: 'How Captionist works' })
    await expect(modal).toBeVisible()
    await expect(modal.getByText('Step 1 of 3')).toBeVisible()

    // Back is disabled on the first step; Next advances.
    await expect(modal.getByRole('button', { name: 'Back' })).toBeDisabled()
    await modal.getByRole('button', { name: 'Next' }).click()
    await expect(modal.getByText('Step 2 of 3')).toBeVisible()

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
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflows).toBe(false)
  })
})
