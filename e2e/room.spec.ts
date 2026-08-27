import { expect, test } from '@playwright/test'

/**
 * The phase-1 gate, in a real browser.
 *
 * `?fast=40` scales the room's clock rather than faking the page's: clock
 * faking is per-page, and once guests live in other pages it would
 * desynchronise the room. `?seed=42` fixes the shuffle so the run is
 * reproducible.
 */
const HARNESS = '/room/DEV?seed=42&bots=4&fast=80'

test.describe('the room spine', () => {
  test('walks the whole flow to the podium, driven only by intents', async ({ page }) => {
    // Five rounds is ~12s of room time at 80x, but this shares a machine with
    // every other spec. The config's 45s default applies to the whole test, so
    // an `expect` timeout above it would simply never be reached.
    test.setTimeout(90_000)
    await page.goto(HARNESS)

    // The lobby is the first state the host broadcasts to itself.
    await expect(page.getByTestId('room-phase')).toHaveText('lobby')

    // Five rounds at 40x. Generous: this asserts the room never stalls, not
    // that it hits a particular wall-clock time.
    await expect(page.getByTestId('room-phase')).toHaveText('podium', { timeout: 60_000 })

    const dump = await page.getByTestId('room-state').textContent()
    const state = JSON.parse(dump ?? '{}')
    expect(state.history).toHaveLength(5)
    expect(state.players).toHaveLength(5)

    // Somebody won something: an empty scoreboard at the podium would mean the
    // flow advanced without anyone actually competing.
    await expect(page.getByTestId('room-standings')).not.toHaveText('no scores yet')
  })

  test('boots straight into a phase from a fixture', async ({ page }) => {
    // No `bots`: with drivers attached the room votes and advances within a
    // frame, so the phase under review has to be left undriven to be seen.
    await page.goto('/room/DEV?seed=42&phase=vote')
    await expect(page.getByTestId('room-phase')).toHaveText('vote')
    const state = JSON.parse((await page.getByTestId('room-state').textContent()) ?? '{}')
    expect(state.players).toHaveLength(5)
    expect(state.round.entries.length).toBeGreaterThan(0)
  })

  test('gives every player who joins a seat colour', async ({ page }) => {
    // No phase assertion: with bots attached the autopilot starts the game the
    // moment the fifth player lands, so `lobby` is gone within a frame.
    await page.goto('/room/DEV?seed=42&bots=4')
    // Unit tests cover the reducer; this covers the whole path, because the
    // gap was invisible until a real room rendered a colourless avatar.
    await expect
      .poll(async () => {
        const dump = await page.getByTestId('room-state').textContent()
        const state = JSON.parse(dump ?? '{}')
        return state.players?.length === 5 && state.players.every((p: { color: string }) => p.color)
      })
      .toBe(true)
  })

  test('rejects a room code that is not a room code', async ({ page }) => {
    const response = await page.goto('/room/not-a-code')
    expect(response?.status()).toBe(404)
  })

  test('does not scroll horizontally at mobile width', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=score')
    await expect(page.getByTestId('room-phase')).toHaveText('score')
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflows).toBe(false)
  })
})
