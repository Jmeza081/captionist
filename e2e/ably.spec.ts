import { expect, test } from '@playwright/test'

/**
 * The token route, against its stub.
 *
 * No browser and no credentials: there is no UI here, and a spec that depends
 * on a live third party is not a test. `?stub=1` is the same switch `ABLY_STUB`
 * throws, so CI never needs a key — exactly how `gifs.spec.ts` covers Giphy.
 */
test.describe('the seat route', () => {
  test('issues a seat that the server can recognise again', async ({ request }) => {
    const first = await request.get('/api/ably/seat?room=C-F34213&stub=1')
    expect(first.status()).toBe(200)

    const minted = (await first.json()) as { seat: string; signature: string }
    expect(minted.seat).toMatch(/^u-[0-9a-f]+$/)
    expect(minted.signature).toMatch(/^[0-9a-f]{64}$/)

    // Presenting both back is how a reload keeps the same chair.
    const again = await request.get(
      `/api/ably/seat?room=C-F34213&stub=1&seat=${minted.seat}&sig=${minted.signature}`,
    )
    const renewed = (await again.json()) as { seat: string }
    expect(renewed.seat).toBe(minted.seat)
  })

  test('refuses a seat nobody signed, and hands out a fresh one', async ({ request }) => {
    // The whole security boundary: without this, a client could ask for a token
    // bearing another player's id and Ably would stamp it onto every message.
    const response = await request.get(
      '/api/ably/seat?room=C-F34213&stub=1&seat=u-someone-else&sig=forged',
    )
    expect(response.status()).toBe(200)

    const body = (await response.json()) as { seat: string }
    expect(body.seat).not.toBe('u-someone-else')
  })

  test('never lets a token be cached', async ({ request }) => {
    const response = await request.get('/api/ably/seat?room=C-F34213&stub=1')
    // The one response in the app that must not be shared or replayed — note
    // the Giphy route deliberately does the opposite.
    expect(response.headers()['cache-control']).toBe('no-store')
  })

  test('says it is stubbed rather than pretending to hold a token', async ({ request }) => {
    const response = await request.get('/api/ably/seat?room=C-F34213&stub=1')
    const body = (await response.json()) as { stub?: boolean; tokenRequest?: unknown }
    expect(body.stub).toBe(true)
    expect(body.tokenRequest).toBeUndefined()
  })
})

test.describe('choosing a transport', () => {
  test('runs on the tab transport when asked, whatever the server has', async ({ page }) => {
    // Forced through the URL rather than inferred from a missing key: a spec
    // that behaves differently depending on whether `.env.local` happens to
    // exist is not testing anything it can name.
    await page.goto('/room/C-F34783?transport=broadcast')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
  })
})
