/**
 * What the bots have cost this room, counted as it happens.
 *
 * The shape `lib/gifs/usage.ts` already established for GIF calls: a local
 * tally, per browser, never on the wire. Not a `RoomEvent`, not game state,
 * and not sent anywhere — the host's tab is the only one that calls the route,
 * so the host's tab is the only one with anything to count.
 *
 * **This is not the cap.** The real ceiling is a monthly spend limit on the
 * Anthropic workspace, which the app cannot exceed however wrong this file is;
 * see `docs/adr/0035`. What this buys is the *graceful* stop — tripping a few
 * cents early so a host reads a sentence instead of a round hitting a 400.
 *
 * Its honest limit: it caps a *room*, not every room. Only the workspace limit
 * does that, and the two are complementary rather than redundant.
 */

/**
 * Dollars per token, per model the route may use.
 *
 * Two of them, priced five times apart, so a tally that assumed one would be
 * wrong by that much whenever the other ran. The route reports which model
 * answered; this prices it. An unknown model falls to the dearer rate — a
 * budget that guesses should guess against itself.
 */
const PRICES: Readonly<Record<string, { input: number; output: number }>> = {
  'claude-opus-5': { input: 5 / 1_000_000, output: 25 / 1_000_000 },
  'claude-haiku-4-5': { input: 1 / 1_000_000, output: 5 / 1_000_000 },
}

const DEAREST = PRICES['claude-opus-5'] ?? { input: 5 / 1_000_000, output: 25 / 1_000_000 }

/**
 * What one room may spend before its bots fall back to written-in jokes.
 *
 * Sized against a game rather than a round number: ~$0.064 for five rounds
 * with four bots under the split in `app/api/bots/turn/route.ts`, so this is
 * roughly a dozen full games in one room — far more than a room can play in a
 * sitting, and small enough that a runaway is a rounding error against the
 * month's cap rather than the month's cap.
 */
export const ROOM_BUDGET_USD = 0.75

interface Spend {
  usd: number
  input: number
  output: number
  calls: number
}

const spend: Spend = { usd: 0, input: 0, output: 0, calls: 0 }

/**
 * Add what one call actually cost, from the response's own `usage`.
 *
 * Priced as it lands rather than totalled at the end, because the two models
 * cannot be summed first — the same token count means a different number of
 * dollars depending on which one produced it.
 */
export function recordSpend(input: number, output: number, model?: string): void {
  const rate = (model ? PRICES[model] : undefined) ?? DEAREST
  const inTokens = Math.max(0, input)
  const outTokens = Math.max(0, output)
  spend.usd += inTokens * rate.input + outTokens * rate.output
  spend.input += inTokens
  spend.output += outTokens
  spend.calls += 1
}

export function spentUsd(): number {
  return spend.usd
}

/** True once this room should stop asking the model. */
export function budgetSpent(): boolean {
  return spentUsd() >= ROOM_BUDGET_USD
}

export interface BudgetReport {
  spentUsd: number
  budgetUsd: number
  /** 0–1, for the meter in `BotPicker`. Clamped, because overshoot is normal. */
  fraction: number
  calls: number
  inputTokens: number
  outputTokens: number
}

export function budgetReport(): BudgetReport {
  const used = spentUsd()
  return {
    spentUsd: used,
    budgetUsd: ROOM_BUDGET_USD,
    fraction: Math.min(1, used / ROOM_BUDGET_USD),
    calls: spend.calls,
    inputTokens: spend.input,
    outputTokens: spend.output,
  }
}

/** Reset between rooms, and in tests. */
export function clearBudget(): void {
  spend.usd = 0
  spend.input = 0
  spend.output = 0
  spend.calls = 0
}
