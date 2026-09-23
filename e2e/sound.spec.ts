import { expect, test, type Page } from '@playwright/test'

/**
 * Background music and sound effects.
 *
 * A browser will not say whether it is making a sound, so the room publishes
 * what its audio engine is doing on the shell: `data-sound` is the context's
 * state and `data-sound-playing` is the bed under the room once it is actually
 * sounding — which means its file was fetched and decoded, not merely asked for.
 */

const shell = (page: Page) => page.locator('[data-sound]')

/** A person who said yes last time, before the page has loaded. */
async function remembersSoundOn(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'captionist:sound',
      JSON.stringify({ music: true, sfx: true, offered: true }),
    )
  })
}

test.describe('sound', () => {
  test('is off until you turn it on, and the lobby asks once', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    // Silent by default: no context at all, never mind a suspended one.
    await expect(shell(page)).toHaveAttribute('data-sound', 'off')
    const offer = page.getByRole('region', { name: 'Sound is off' })
    await expect(offer).toBeVisible()

    await offer.getByRole('button', { name: 'Turn sound on' }).click()
    await expect(offer).toHaveCount(0)
    await expect(shell(page)).toHaveAttribute('data-sound', 'running')
    await expect(shell(page)).toHaveAttribute('data-sound-playing', 'title')

    // The toolbox says so, and names what is playing.
    await page.getByRole('button', { name: 'Host toolbox' }).click()
    const toolbox = page.getByRole('region', { name: 'Host toolbox' })
    await expect(toolbox.getByRole('switch', { name: 'Music' })).toHaveAttribute('aria-checked', 'true')
    await expect(toolbox.getByRole('switch', { name: 'Sound effects' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(toolbox.getByText('Title Screen · Juhani Junkala')).toBeVisible()
  })

  test('mutes from the toolbox, and the mute survives a reload', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await page.getByRole('button', { name: 'Turn sound on' }).click()
    await expect(shell(page)).toHaveAttribute('data-sound-playing', 'title')

    await page.getByRole('button', { name: 'Host toolbox' }).click()
    const music = page.getByRole('region', { name: 'Host toolbox' }).getByRole('switch', { name: 'Music' })
    await music.click()
    await expect(music).toHaveAttribute('aria-checked', 'false')
    await expect(shell(page)).not.toHaveAttribute('data-sound-playing', /.+/)

    await page.reload()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
    // Answered once, so it does not ask again — whatever the answer was.
    await expect(page.getByRole('region', { name: 'Sound is off' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Host toolbox' }).click()
    await expect(
      page.getByRole('region', { name: 'Host toolbox' }).getByRole('switch', { name: 'Music' }),
    ).toHaveAttribute('aria-checked', 'false')
  })

  test('keeping it quiet keeps the room silent', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await page.getByRole('button', { name: 'Keep it quiet' }).click()
    await expect(page.getByRole('region', { name: 'Sound is off' })).toHaveCount(0)
    await expect(shell(page)).toHaveAttribute('data-sound', 'off')
  })

  test('picks up where the room is after a reload, in the phase it is in', async ({ page }) => {
    await remembersSoundOn(page)
    await page.goto('/room/DEV?seed=42&phase=compose')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose')

    // This browser allows sound without a tap, so there is nothing to ask —
    // and the room must not flash a refusal while it finds that out.
    await expect(shell(page)).toHaveAttribute('data-sound', 'running')
    await expect(page.getByText('Tap anywhere to bring the sound back.')).toHaveCount(0)
    // Writing has its own bed.
    await expect(shell(page)).toHaveAttribute('data-sound-playing', 'stageSelect')
  })
})

test.describe('sound, where the browser wants a tap first', () => {
  /*
    The policy phones ship with: a context made before the page has seen a tap
    stays suspended until one resumes it. Playwright's Chromium allows sound
    outright and will not be argued out of it by launch flags, so the policy is
    imposed in the page instead — every context born without a gesture is
    suspended the moment it exists, which is what the browser would have done.
  */
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const Real = window.AudioContext
      window.AudioContext = class extends Real {
        constructor(options?: AudioContextOptions) {
          super(options)
          // Twice over: once at birth, and again if the browser starts it
          // anyway — under load its own start can land after our suspend.
          const hold = () => {
            if (this.state === 'running' && !navigator.userActivation.hasBeenActive) {
              void this.suspend()
            }
          }
          if (!navigator.userActivation.hasBeenActive) void this.suspend()
          this.addEventListener('statechange', hold)
        }
      }
    })
  })

  test('says so after a reload, and any tap brings it back', async ({ page }) => {
    // Somebody who said yes last time, before the page has loaded.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'captionist:sound',
        JSON.stringify({ music: true, sfx: true, offered: true }),
      )
    })
    await page.goto('/room/DEV?seed=42&phase=compose')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'compose')

    const blocked = page.getByRole('status').filter({
      hasText: 'Tap anywhere to bring the sound back.',
    })
    await expect(blocked).toBeVisible()
    await expect(shell(page)).toHaveAttribute('data-sound', 'suspended')

    // Any tap — here, on the headline, which does nothing else.
    await page.getByRole('heading', { level: 1 }).first().click()
    await expect(blocked).toHaveCount(0)
    await expect(shell(page)).toHaveAttribute('data-sound', 'running')
    await expect(shell(page)).toHaveAttribute('data-sound-playing', 'stageSelect')
  })

  test('the lobby offer is the tap', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=lobby')
    await page.getByRole('button', { name: 'Turn sound on' }).click()
    await expect(shell(page)).toHaveAttribute('data-sound', 'running')
    await expect(shell(page)).toHaveAttribute('data-sound-playing', 'title')
  })
})
