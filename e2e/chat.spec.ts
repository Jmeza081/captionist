import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * The phase-6 gate, as the roadmap words it:
 *
 *   "ChatRail fills; vote-card tallies go live."
 *
 * One test per clause, plus the guards that make chat safe to leave open in a
 * room of twenty. Every tab here is a separate `BroadcastChannel` peer in one
 * browser — the same road phase 4 and 5 take, and the same one Ably replaces
 * without any of this moving.
 */

/**
 * A distinct code per test, because a room is claimed by the first tab to ask
 * for it and the suite runs fully parallel. Every one matches `CODE_PATTERN`.
 */
const TWO_TABS = 'C-F34791'
const EMPTY = 'C-F34792'
const UNREAD = 'C-F34793'
const HOSTED = 'C-F34794'
const FLOOD = 'C-F34795'

/** A guest arrives through `/join`, because that is where it gets a name. */
async function join(context: BrowserContext, code: string, name: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/join/${code}`)
  await page.getByRole('textbox', { name: 'Nickname' }).fill(name)
  await page.getByRole('button', { name: 'Join the room' }).click()
  await expect(page.locator('main[data-phase]')).toBeVisible()
  return page
}

/**
 * Chat is collapsed by default, at both sizes.
 *
 * Settles on the composer rather than the message list: an empty room has no
 * list at all, and waiting for one would only ever pass in a room that had
 * already been talked in.
 */
async function openChat(page: Page): Promise<void> {
  // Above `md` the rail arrives docked open — the room greets you with chat
  // rather than with a key to press — so there may be nothing to click.
  //
  // `count()` does not retry, so the room has to have settled into one shape or
  // the other before it is asked: on a phone this raced the first paint and
  // read zero keys on a rail that was about to draw one.
  const composer = page.getByRole('textbox', { name: 'Message the room' })
  const key = page.getByRole('button', { name: /^Open chat/ })
  await expect(composer.or(key).first()).toBeVisible()
  if (await key.count()) await key.click()
  await expect(composer).toBeVisible()
}

/** Puts the rail back to its collapsed strip, wherever it started. */
async function closeChat(page: Page): Promise<void> {
  const key = page.getByRole('button', { name: 'Close chat' })
  if (await key.count()) await key.click()
  await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()
}

async function say(page: Page, text: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Message the room' }).fill(text)
  await page.getByRole('button', { name: 'Send message' }).click()
}

test.describe('the phase 6 gate', () => {
  test('carries a message from one tab to another', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${TWO_TABS}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, TWO_TABS, 'Vic')

    await openChat(guest)
    await say(guest, 'is this thing on')

    // The room heard it, and so did the person who said it.
    await expect(guest.getByText('is this thing on')).toBeVisible()

    await openChat(host)
    await expect(host.getByText('is this thing on')).toBeVisible()
  })

  test('says so when nobody has spoken', async ({ page }) => {
    await page.goto(`/room/${EMPTY}?seed=42&phase=vote&gifs=stub`)
    await openChat(page)
    await expect(page.getByText('Nobody has said anything yet.')).toBeVisible()
  })

  test('badges the collapsed rail, and clears it on opening', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${UNREAD}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, UNREAD, 'Vic')
    // Above `md` the host's rail arrives open, and an open rail is read. The
    // unread run is what this is about, so the host has to be looking away.
    await closeChat(host)
    await openChat(guest)
    await say(guest, 'anybody there')

    // The host is not looking at chat, so the count is on the closed key — and
    // it is in the label, not only in the badge, because a number in a corner
    // says nothing to a screen reader.
    const key = host.getByRole('button', { name: /^Open chat, 1 unread message$/ })
    await expect(key).toBeVisible()

    await key.click()
    await expect(host.getByText('anybody there')).toBeVisible()
    await expect(host.getByRole('button', { name: 'Close chat' })).toBeVisible()
  })

  test('treats the host’s own line as chat, not as the room speaking', async ({
    context,
  }) => {
    const host = await context.newPage()
    await host.goto(`/room/${HOSTED}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')
    await join(context, HOSTED, 'Vic')

    await openChat(host)
    await say(host, '30 seconds left on voting. No lobbying.')

    const line = host.getByRole('article').filter({
      hasText: '30 seconds left on voting. No lobbying.',
    })
    await expect(line).toHaveCount(1)

    // It used to be an accent announcement card signed "HOST · HOST", for every
    // line the host typed — and that branch drew only the body, so a GIF from
    // the host was an empty purple box. The host is a player (ADR 0004); an
    // announcement is a thing you do, and there is no action for it yet.
    await expect(host.getByText(/· host$/i)).toHaveCount(0)
    // An `article` is the player row, so the reaction key came back with it.
    await expect(line.getByRole('button', { name: /message$/ })).toHaveCount(1)
  })

  test('drops a second message inside the rate limit', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${FLOOD}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    await openChat(host)
    await say(host, 'the first thing said')
    await say(host, 'immediately afterwards')

    await expect(host.getByText('the first thing said')).toBeVisible()
    // Both were sent well inside 1.5s, so the room kept the first and dropped
    // the second. The guard is on receive: a sender cannot opt out of it.
    await expect(host.getByText('immediately afterwards')).toHaveCount(0)
  })
})

test.describe('the rail on arrival', () => {
  test('greets a docked room with chat already open', async ({ page }) => {
    test.skip(page.viewportSize()!.width < 768, 'below `md` the rail is a sheet')
    await page.goto('/room/C-F34901?gifs=stub')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    // No key to press: where there is room to dock the rail, the room opens
    // with it already there.
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Open chat/ })).toHaveCount(0)
  })

  test('does not throw a sheet over a phone', async ({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, 'above `md` the rail docks')
    await page.goto('/room/C-F34902?gifs=stub')
    await expect(page.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    // A phone's rail covers the room, so arriving inside it would be taking
    // the lobby away from somebody who just got here.
    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toHaveCount(0)
  })

  test('a close is remembered, and the viewport does not overrule it', async ({
    page,
  }) => {
    test.skip(page.viewportSize()!.width < 768, 'below `md` it starts closed anyway')
    await page.goto('/room/C-F34903?gifs=stub')
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible()

    await page.getByRole('button', { name: 'Close chat' }).click()
    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()

    // The default is derived from the viewport, so the thing to prove is that
    // your own answer outranks it rather than being recomputed over the top.
    await page.getByRole('heading', { name: 'Players' }).click()
    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible()
  })
})

test.describe('reaction tallies', () => {
  test('go live on a vote card', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')
    await expect(page.getByRole('heading', { name: 'Rank your top three.' })).toBeVisible()

    // No reactions yet, so no counts — an empty tally is absent, not a zero.
    await expect(page.getByText(/, 1 reaction$/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Add a reaction' }).first().click()
    await page.getByRole('button', { name: 'Fire', exact: true }).click()

    // The count is the room's, and it says so in a way a screen reader can
    // read: `TallyPill` carries a visually-hidden sentence beside the digit.
    await expect(page.getByText('Fire, 1 reaction, including yours')).toBeVisible()
  })

  test('counts one person once, however many times they tap', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')
    await expect(page.getByRole('heading', { name: 'Rank your top three.' })).toBeVisible()

    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Add a reaction' }).first().click()
      await page.getByRole('button', { name: 'Fire', exact: true }).click()
    }

    // Counts only rise, and a repeat from the same person is not a rise.
    await expect(page.getByText('Fire, 1 reaction, including yours')).toBeVisible()
  })

  test('does not disturb the ranking underneath', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')

    await page.getByRole('button', { name: 'Add a reaction' }).first().click()
    await page.getByRole('button', { name: 'Fire', exact: true }).click()

    // A reaction is not a vote. The gate still asks for three picks, which is
    // the whole reason the counts can be live without herding anybody.
    await expect(page.getByRole('button', { name: 'Pick 3 more' })).toBeVisible()
  })
})

/**
 * An attachment in a message.
 *
 * The composer has declared every attachment prop since phase 2 and `ChatPanel`
 * passed none of them, so this whole surface existed only in the gallery. The
 * wire is what was missing: the `chat` event carried a bare string.
 *
 * Two things produce one. An image reaction posts immediately, carrying its
 * attachment inline; the GIF picker in the rail *stages* one for the send key.
 *
 * That picker was removed once, because mounting it spent an API call for every
 * player the moment they joined the room (ADR-0021). It is back, mounted only
 * while it is open — which is the shape that finding actually called for, and
 * is asserted below rather than assumed. See ADR-0026.
 */
const ATTACH = 'C-F34796'
const EMPTYSEND = 'C-F34797'
const NOGIFKEY = 'C-F34798'
const LAZYGIF = 'C-F34799'

/** The committed Slackmoji art an image reaction posts. Avatars are `<img>` too. */
const ATTACHED = 'img[src^="/media/slackmoji-"]'

test.describe('attaching an image', () => {
  test('posts an image reaction as an attachment, and it crosses the wire', async ({
    context,
  }) => {
    const host = await context.newPage()
    await host.goto(`/room/${ATTACH}?gifs=stub`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, ATTACH, 'Vic')
    await openChat(guest)

    await guest.getByRole('button', { name: 'Add a reaction' }).click()
    await guest
      .getByRole('dialog', { name: 'Send an emoji' })
      .getByRole('button', { name: 'Shipit squirrel' })
      .click()

    // **A picture is an attachment, not a sentence.** Posting the glyph as
    // words would render `/media/slackmoji-shipit.svg` in 14px type, which is
    // exactly the bug this path exists to avoid.
    const guestLog = guest.getByRole('log', { name: 'Room chat' })
    await expect(guestLog.locator(ATTACHED)).toBeVisible()
    await expect(guestLog).not.toContainText('slackmoji')

    // And it crosses the wire, which is the half that did not exist. Settle on
    // the image rather than words: this message has none.
    await openChat(host)
    await expect(host.getByRole('log', { name: 'Room chat' }).locator(ATTACHED)).toBeVisible()
  })

  test('will not send an empty message', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${EMPTYSEND}?gifs=stub`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, EMPTYSEND, 'Vic')
    await openChat(guest)

    // Nothing stages into the composer any more, so an empty draft is simply
    // an empty message — there is no second way to make one sendable.
    await expect(guest.getByRole('button', { name: 'Send message' })).toBeDisabled()
    await guest.getByRole('textbox', { name: /message/i }).fill('exhibit A')
    await expect(guest.getByRole('button', { name: 'Send message' })).toBeEnabled()
  })

  test('stages a GIF from the rail picker and sends it', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${NOGIFKEY}?gifs=stub`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, NOGIFKEY, 'Vic')
    await openChat(guest)

    await expect(guest.getByRole('button', { name: 'Add a reaction' })).toBeVisible()
    await guest.getByRole('button', { name: 'Attach a GIF' }).click()

    const panel = guest.getByRole('dialog', { name: 'Attach a GIF' })
    await expect(panel).toBeVisible()
    await panel.getByRole('button').filter({ has: guest.locator('img') }).first().click()

    // Staged, not sent: a GIF waits on the send key, which is what makes it a
    // message rather than a reaction. The send key goes live on the attachment
    // alone — a GIF is a complete thing to say.
    await expect(panel).toBeHidden()
    await expect(guest.getByText('GIF attached')).toBeVisible()
    await expect(guest.getByRole('button', { name: 'Send message' })).toBeEnabled()

    await guest.getByRole('button', { name: 'Send message' }).click()
    await expect(guest.getByText('GIF attached')).toBeHidden()

    // And it crosses the wire. `lib/gifs/allow.ts` gates the src on the event
    // lane, so a GIF that failed the allowlist would arrive as nothing.
    await openChat(host)
    await expect(
      host.getByRole('log', { name: 'Room chat' }).locator('img'),
    ).not.toHaveCount(0)
  })

  test('does not open a picker, or spend a call, just by joining', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${LAZYGIF}?gifs=stub`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, LAZYGIF, 'Vic')
    await openChat(guest)

    // The regression ADR-0021 actually found, and the reason the picker can be
    // back at all: it used to fetch on mount, so every player in the room paid
    // for a surface most of them never opened. The key is offered; the panel
    // is not mounted until it is tapped.
    await expect(guest.getByRole('button', { name: 'Attach a GIF' })).toBeVisible()
    await expect(guest.getByRole('dialog', { name: 'Attach a GIF' })).toHaveCount(0)
  })
})

/**
 * A chat GIF that has not arrived yet.
 *
 * The composer's staged tile and the message it becomes are both remote GIFs
 * fetched at their own size, and both were a blank rounded box until the bytes
 * landed — the picker board's gap, one tile wide. `TunedImage` puts a set
 * behind each. The *picker* over the composer is still deliberately plain: a
 * dozen flickering thumbnails over a live chat rail is a different amount of
 * noise from one, and that is `tuning={board}` in `GifPanel`.
 *
 * One page, not two. Every other test in this file needs a real second peer to
 * say something about the wire; this one is about what one browser draws, so it
 * takes a seat in a fixture room and leaves the tabs alone. Four multi-page
 * tests here cost the parallel run enough to time out the width sweep in
 * `responsive.spec.ts`, which is a real fixture of this suite's budget.
 *
 * Blocked rather than raced, like every other spec in this family: a stub tile
 * is a local SVG and decodes in milliseconds.
 */
test.describe('a chat GIF with no picture yet', () => {
  const SEAT = '/room/DEV?seed=42&phase=vote&as=p2&gifs=stub'

  /** Stage a GIF off the rail's picker, and hand back the composer's row. */
  async function stage(page: Page) {
    await openChat(page)
    await page.getByRole('button', { name: 'Attach a GIF' }).click()
    const panel = page.getByRole('dialog', { name: 'Attach a GIF' })
    await panel.getByRole('button').filter({ has: page.locator('img') }).first().click()
    await expect(panel).toBeHidden()
    // Scoped to the composer's own row — the picker it came from has no set,
    // and a page-wide count could not tell the two apart.
    return page.getByText('GIF attached').locator('xpath=../..')
  }

  test('tunes the staged tile, and the message it becomes', async ({ page }) => {
    await page.route('**/media/stub-*', (route) => route.abort())
    await page.goto(SEAT)

    const staged = await stage(page)
    await expect(staged.locator('[data-testid="tv-static"]')).toBeVisible()

    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText('GIF attached')).toBeHidden()

    /**
     * And the message it turned into, at a size worth having.
     *
     * A chat attachment is the one image in the app that reserves no box of its
     * own — bounded rather than forced, so a 64px Slackmoji is never
     * letterboxed into a banner — which makes it zero-height until its bytes
     * land. `.attachment [data-tuning]` stands the design's size in until then,
     * and without that this would still "be visible" at no height at all.
     */
    const log = page.getByRole('log', { name: 'Room chat' })
    const set = log.locator('[data-testid="tv-static"]').first()
    await expect(set).toBeVisible()
    const box = await set.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThan(100)
  })

  test('drops the set on both once the picture is there', async ({ page }) => {
    await page.goto(SEAT)

    const staged = await stage(page)
    await expect(staged.locator('[data-testid="tv-static"]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Send message' }).click()
    const log = page.getByRole('log', { name: 'Room chat' })
    await expect(log.locator('img')).not.toHaveCount(0)
    await expect(log.locator('[data-testid="tv-static"]')).toHaveCount(0)
  })
})


/**
 * What the room says about itself.
 *
 * Both cases are about somebody *other than the actor* finding out: the host
 * who flips the mode already knows, and the player whose tab closed is not
 * reading anything. See ADR 0028.
 */
test.describe('room announcements', () => {
  const MODE = 'C-F34796'
  const DROP = 'C-F34797'

  test('tells the whole room the host changed the mode', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${MODE}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, MODE, 'Vic')
    await openChat(guest)

    // The lobby's own control, which used to notify nobody but the host.
    await host.getByRole('radio', { name: 'React to the caption' }).click()

    const log = guest.getByRole('log', { name: 'Room chat' })
    await expect(log.getByText('New mode: React to the caption.')).toBeVisible()
    // Drawn as the room speaking, not as anybody chatting: the accent card is
    // signed "Room", and no player's name appears on it.
    await expect(log.getByText('Room', { exact: true })).toBeVisible()
    await expect(log.getByText('Vic', { exact: true })).toHaveCount(0)
  })

  test('says who dropped, and says it once', async ({ context }) => {
    const host = await context.newPage()
    await host.goto(`/room/${DROP}`)
    await expect(host.locator('main[data-phase]')).toHaveAttribute('data-phase', 'lobby')

    const guest = await join(context, DROP, 'Vic')
    await openChat(host)
    // The presence pill lives in the rail, so this waits for the rail's own
    // view of the room rather than for a roster the header does not draw.
    await expect(host.getByText('2 here')).toBeVisible()

    await guest.close()

    await expect(host.getByText(/^Vic dropped out\./)).toBeVisible({ timeout: 20_000 })
    await expect(host.getByText(/^Vic dropped out\./)).toHaveCount(1)
  })
})
