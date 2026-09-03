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

/** Claude Haiku 4.5, dollars per token. The route bills nothing else. */
const INPUT_PER_TOKEN = 1 / 1_000_000
const OUTPUT_PER_TOKEN = 5 / 1_000_000

/**
 * What one room may spend before its bots fall back to written-in jokes.
 *
 * Sized against a measured game rather than a guess: ~$0.018 for five rounds
 * with four bots, so this is roughly a dozen full games in one room — far more
 * than a room can play in a sitting, and small enough that a runaway loop is a
 * rounding error rather than a bill.
 */
export const ROOM_BUDGET_USD = 0.25

interface Spend {
  input: number
  output: number
  calls: number
}

const spend: Spend = { input: 0, output: 0, calls: 0 }

/** Add what one call actually cost, from the response's own `usage`. */
export function recordSpend(input: number, output: number): void {
  spend.input += Math.max(0, input)
  spend.output += Math.max(0, output)
  spend.calls += 1
}

export function spentUsd(): number {
  return spend.input * INPUT_PER_TOKEN + spend.output * OUTPUT_PER_TOKEN
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
  spend.input = 0
  spend.output = 0
  spend.calls = 0
}
