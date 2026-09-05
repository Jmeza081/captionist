import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test'

/**
 * Bots the host hired.
 *
 * Three things are worth a browser rather than a unit test: that the control
 * exists where the design puts it, that a bot reaches *other* tabs, and that
 * the route is gated. The comedy itself is not testable and is not tested —
 * that check is a human reading captions, and the plan says so.
 *
 * `?brain=stub` is the same switch `NEXT_PUBLIC_BOTS_STUB` throws, so the
 * suite never spends a token. `?brain=live` opts one page load onto the route,
 * which is what makes the call-counting below count something.
 */

const TURN = '**/api/bots/turn'

/** Open a fresh lobby as the host. */
async function lobby(page: Page, query = '') {
  await page.goto(`/room/DEV?seed=42&gifs=stub${query}`)
  await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
}

async function hire(page: Page, level: RegExp = /Principal/) {
  await page.getByRole('button', { name: /^Add a bot/ }).click()
  await expect(page.getByTestId('bot-picker')).toBeVisible()
  await page.getByRole('radio', { name: level }).click()
  await page.getByRole('button', { name: /^Hire/ }).click()
  await expect(page.getByTestId('bot-picker')).toBeHidden()
}

test.describe('hiring from the lobby', () => {
  test('seats a bot with a name, a face and a badge', async ({ page }) => {
    await lobby(page)
    await expect(page.getByText('1 of 20')).toBeVisible()

    await hire(page)

    await expect(page.getByText('2 of 20')).toBeVisible()
    // The badge is the thing that stops a player believing a bot is a
    // colleague, so it is asserted rather than assumed — and it names the
    // level, because which one you hired is the thing you want at a glance.
    await expect(page.getByText('Principal bot', { exact: true })).toBeVisible()
  })

  test('offers the three levels, each with a sentence', async ({ page }) => {
    await lobby(page)
    await page.getByRole('button', { name: /^Add a bot/ }).click()

    const picker = page.getByTestId('bot-picker')
    for (const level of ['Intern', 'Senior', 'Principal']) {
      await expect(picker.getByRole('radio', { name: new RegExp(level) })).toBeVisible()
    }
    // A radiogroup, not a segmented control: each level carries the sentence
    // that makes it a choice rather than a label.
    await expect(picker.getByRole('radiogroup')).toBeVisible()
  })

  test('closes on Escape without seating anybody', async ({ page }) => {
    await lobby(page)
    await page.getByRole('button', { name: /^Add a bot/ }).click()
    await expect(page.getByTestId('bot-picker')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('bot-picker')).toBeHidden()
    await expect(page.getByText('1 of 20')).toBeVisible()
  })

  test('the control is reachable by keyboard and shows a focus ring', async ({ page }) => {
    await lobby(page)
    const add = page.getByRole('button', { name: /^Add a bot/ })
    await add.focus()
    await expect(add).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('bot-picker')).toBeVisible()
  })
})

test.describe('a bot in a real game', () => {
  test('plays a full round: picks, captions and votes', async ({ page }) => {
    // Three bots plus the host clears `MIN_PLAYERS`, so the room can start.
    await lobby(page, '&fast=80')
    await hire(page, /Intern/)
    await hire(page, /Senior/)
    await hire(page, /Principal/)

    await expect(page.getByText('4 of 20')).toBeVisible()
    await page.getByRole('button', { name: /^Start game/ }).click()

    // The room reaches a vote, which can only happen if every bot set a
    // subject when it held the role and answered when it did not.
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote', {
      timeout: 30_000,
    })
    // And then past it, which needs their ballots too.
    await expect(page.locator('main[data-phase]')).toHaveAttribute(
      'data-phase',
      /reveal|score/,
      { timeout: 30_000 },
    )
  })
})

test.describe('the route', () => {
  test('refuses a request with no signed seat', async ({ request }) => {
    // The whole boundary between the key and the open internet. Worth a test
    // rather than trust: everything else here would pass without it.
    const response = await request.post('/api/bots/turn', {
      data: { kind: 'answers', mode: 'caption', roundNumber: 1, bots: [] },
    })
    expect(response.status()).toBe(403)
  })

  test('refuses a forged signature', async ({ request }) => {
    const response = await request.post('/api/bots/turn', {
      data: { kind: 'answers', mode: 'caption', roundNumber: 1, seat: 'p1', sig: 'not-a-signature' },
    })
    expect(response.status()).toBe(403)
  })

  test('asks once per phase, not once per bot', async ({ page }) => {
    // **The batching contract.** It is the difference between cents and
    // dollars a game, and it is exactly the kind of thing a well-meaning
    // refactor turns back into a loop without any test noticing.
    const calls: Request[] = []
    await page.route(TURN, async (route) => {
      calls.push(route.request())
      // Answer as the route would with no key, so the room falls to the
      // written-in corpus and the game still finishes.
      await route.fulfill({ status: 200, json: { stub: true } })
    })

    await lobby(page, '&fast=80&brain=live')
    await hire(page, /Intern/)
    await hire(page, /Senior/)
    await hire(page, /Principal/)
    await page.getByRole('button', { name: /^Start game/ }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote', {
      timeout: 30_000,
    })

    const answers = calls.filter((call) => {
      const body = call.postDataJSON() as { kind?: string }
      return body.kind === 'answers'
    })
    // Three bots competed in at least one round, and asked once between them.
    expect(answers.length).toBeGreaterThan(0)
    for (const call of answers) {
      const body = call.postDataJSON() as { bots?: unknown[] }
      expect((body.bots ?? []).length).toBeGreaterThan(1)
    }
  })

  test('never sends a player’s name to the model', async ({ page }) => {
    // Structural, not a rule: the browser sends seat ids and levels, and the
    // projection the bots read has already stripped authorship. This is the
    // tripwire for a future field quietly widening that.
    const bodies: string[] = []
    await page.route(TURN, async (route) => {
      bodies.push(route.request().postData() ?? '')
      await route.fulfill({ status: 200, json: { stub: true } })
    })

    await lobby(page, '&fast=80&brain=live')
    await hire(page, /Senior/)
    await hire(page, /Principal/)

    // Read the nicknames off the lobby, which is the only screen that lists
    // them — by the vote the board shows cards, not a roster.
    const roster = await page.locator('main').innerText()
    const names = roster.match(/\b[A-Z][a-z]+_[A-Z][a-z]+\b/g) ?? []
    expect(names.length).toBeGreaterThan(0)

    await page.getByRole('button', { name: /^Start game/ }).click()
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'vote', {
      timeout: 30_000,
    })

    for (const body of bodies) {
      for (const name of names) expect(body).not.toContain(name)
    }
  })
})

test.describe('a bot, from the other side of the wire', () => {
  /**
   * The claim this whole design rests on.
   *
   * Bots run in the host's tab and reach the engine directly (ADR 0034), so
   * "host-local" has to describe the plumbing and nothing a player can see.
   * Only a second tab can prove that: everything else in this file watches the
   * tab that owns the pool, where a bot that never left the browser would look
   * exactly the same.
   */
  async function joinAs(context: BrowserContext, code: string, name: string): Promise<Page> {
    const page = await context.newPage()
    await page.goto(`/join/${code}`)
    await page.getByRole('textbox', { name: 'Nickname' }).fill(name)
    await page.getByRole('button', { name: 'Join the room' }).click()
    await expect(page.locator('main[data-phase]')).toBeVisible()
    return page
  }

  test('appears in the guest’s roster, badge and all', async ({ context }) => {
    const host = await context.newPage()
    await host.goto('/host')
    await host.getByRole('textbox', { name: 'Nickname' }).fill('Jesse')
    await host.getByRole('button', { name: 'Open the room' }).click()
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const code = new URL(host.url()).pathname.split('/').pop() ?? ''
    const guest = await joinAs(context, code, 'Vic')

    await hire(host, /Principal/)

    // The name the host's tab invented, read off the host's own roster.
    const roster = await host.locator('main').innerText()
    const name = (roster.match(/\b[A-Z][a-z]+_[A-Z][a-z]+\b/g) ?? [])[0]
    expect(name).toBeDefined()

    // And now the only assertion that matters: the guest sees it too, as a
    // player, labelled — without the guest's tab having any pool at all.
    await expect(guest.getByRole('listitem').filter({ hasText: name as string })).toBeVisible()
    await expect(guest.getByText('Principal bot', { exact: true })).toBeVisible()
    // Three seats from the guest's side: the host, the guest, the bot. The
    // "N of 20" counter is the host's roster card, so it is not asserted here.
    await expect(guest.getByRole('listitem')).toHaveCount(3)
  })
})
