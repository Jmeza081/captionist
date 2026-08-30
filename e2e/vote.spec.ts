import { expect, test } from '@playwright/test'

/**
 * Ranking, and the sudden death that a dead heat routes to.
 *
 * The ranking is local draft state until it is locked: the reducer tallies the
 * round the moment the last ballot lands, so a per-tap dispatch would end
 * voting for everyone as soon as one person made their first pick.
 */
test.describe('voting', () => {
  test('ranks three and says what is still missing until it can lock', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')

    await expect(page.getByRole('heading', { name: 'Rank your top three.' })).toBeVisible()
    await expect(page.getByText('4 submissions · shuffled so nobody games the order')).toBeVisible()

    // Blocked, not disabled: the label is where the missing thing is stated.
    await expect(page.getByRole('button', { name: 'Pick 3 more' })).toBeVisible()

    const rank = page.getByRole('button', { name: 'Rank this' })
    await rank.first().click()
    await expect(page.getByRole('button', { name: 'Pick 2 more' })).toBeVisible()
    await rank.first().click()
    await rank.first().click()

    await expect(page.getByRole('button', { name: 'Lock my ranking' })).toBeVisible()
    await page.getByRole('button', { name: 'Lock my ranking' }).click()
    await expect(page.getByRole('status')).toHaveText('Ranking locked in')
  })

  test('ranks a card by its picture, not just by the button', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')

    await expect(page.getByRole('button', { name: 'Pick 3 more' })).toBeVisible()

    // The picture is the joke, so the picture is the target. The button under
    // it stays — it is the keyboard's route to the same thing — but a card is
    // something people reach for whole.
    const card = page.locator('figure').filter({ hasText: 'Rank this' }).first()
    // Clicking the picture's own coordinates. `force` because the thing that
    // actually receives the click is the transparent target lying over the
    // image — Playwright's actionability check calls that an interception,
    // which here is the mechanism working rather than a page that moved.
    await card.locator('img').click({ force: true })
    await expect(page.getByRole('button', { name: 'Pick 2 more' })).toBeVisible()

    // The ranked one, found by what its foot now says rather than by position:
    // ranking re-labels the card, so the locator above no longer matches it.
    const ranked = page.locator('figure').filter({ hasText: 'Clear 1st' })
    await expect(ranked).toHaveCount(1)

    // Clicking the picture again takes the rank back off, the same as the button.
    await ranked.locator('img').click({ force: true })
    await expect(page.getByRole('button', { name: 'Pick 3 more' })).toBeVisible()
  })

  test('fills the rank slots, and clearing one puts the pick back', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')

    await expect(page.getByRole('button', { name: /^1st, empty$/ })).toBeVisible()

    await page.getByRole('button', { name: 'Rank this' }).first().click()
    const first = page.getByRole('button', { name: /^Clear 1st: / })
    await expect(first).toBeVisible()

    await first.click()
    await expect(page.getByRole('button', { name: /^1st, empty$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pick 3 more' })).toBeVisible()
  })

  test('will not let you rank your own', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&gifs=stub')

    // Four entries, one of them this viewer's — so only three are rankable.
    await expect(page.getByRole('button', { name: 'Rank this' })).toHaveCount(3)
    await expect(page.getByText('Your own caption')).toBeVisible()
  })

  test('pins the prompt above the grid in the reversed mode', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&mode=react&as=p2&gifs=stub')

    await expect(page.getByRole('heading', { name: 'Rank your top three.' })).toBeVisible()
    await expect(
      page.getByText('3 points for first, 2 for second, 1 for third. Answers are anonymous until the reveal.'),
    ).toBeVisible()
  })
})

test.describe('sudden death', () => {
  test('names both contenders — a duel cannot be anonymous', async ({ page }) => {
    // `p3` authored neither tied entry, so both cards are theirs to vote on.
    await page.goto('/room/DEV?seed=42&phase=tiebreak&as=p3&gifs=stub')

    await expect(page.getByText('Somebody has to break this tie.')).toBeVisible()
    await expect(page.getByText(/can’t vote in their own duel/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Vote this one' })).toHaveCount(2)
  })

  test('will not let a contender vote in their own duel', async ({ page }) => {
    // `p2` authored one of the two tied entries. `authorize` refuses that vote,
    // so the button says so rather than producing a refusal snackbar.
    await page.goto('/room/DEV?seed=42&phase=tiebreak&as=p2&gifs=stub')

    await expect(page.getByRole('button', { name: 'Your own entry' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Vote this one' })).toHaveCount(1)
  })

  test('names the role that breaks a persisting deadlock, per mode', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=tiebreak&as=p2&gifs=stub')
    await expect(page.getByText(/The Captionist gets the deciding vote/)).toBeVisible()

    await page.goto('/room/DEV?seed=42&phase=tiebreak&mode=react&as=p2&gifs=stub')
    await expect(page.getByText(/The Prompter gets the deciding vote/)).toBeVisible()
  })

  test('takes a vote and stops asking for another', async ({ page }) => {
    await page.goto('/room/DEV?seed=42&phase=tiebreak&as=p3&gifs=stub')

    await page.getByRole('button', { name: 'Vote this one' }).first().click()
    await expect(page.getByRole('button', { name: 'Vote cast' }).first()).toBeVisible()
  })
})

/**
 * The room setting that was offered and never honoured.
 *
 * `HostSetupScreen` has shipped a live "Single vote" control since phase 4, but
 * `VoteScreen` always cast `kind: 'rank'` — so the reducer paid `RANK_POINTS[0]`
 * and a room that promised one point paid three. Nothing covered the setting end
 * to end, which is exactly why it survived. These are that cover.
 */
test.describe('a single-vote room', () => {
  test('asks for one pick, and says so in the label rather than going quiet', async ({
    page,
  }) => {
    await page.goto('/room/DEV?seed=42&phase=vote&as=p2&voting=single&gifs=stub')

    await expect(page.getByRole('heading', { name: 'Pick the best one.' })).toBeVisible()
    await expect(page.getByText(/1 point to whoever you pick/)).toBeVisible()

    // One slot, not three — `rankSlotCount` used to ignore the setting and draw
    // three, which then disagreed with a gate asking for one.
    await expect(page.getByRole('button', { name: /empty$/ })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Pick one' })).toBeVisible()

    await page.getByRole('button', { name: 'Pick this' }).first().click()
    await expect(page.getByRole('button', { name: 'Lock my pick' })).toBeVisible()
    await page.getByRole('button', { name: 'Lock my pick' }).click()
    await expect(page.getByRole('status')).toHaveText('Pick locked in')
  })

  test('pays one point a ballot, where a ranking room pays three', async ({ page }) => {
    // The regression that matters, asserted where points are actually visible.
    // Four voters converge on one entry, so a single-vote room pays 4; the same
    // fixture ranked pays 3/2/1 across three entries and lands in double figures.
    await page.goto('/room/DEV?seed=42&phase=reveal&voting=single&gifs=stub')
    await expect(page.getByText('4 votes this round')).toBeVisible()
    await expect(page.getByText(/ranking points/)).toBeHidden()

    await page.goto('/room/DEV?seed=42&phase=reveal&gifs=stub')
    await expect(page.getByText(/ranking points this round/)).toBeVisible()
  })
})
