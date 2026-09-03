import { beforeEach, describe, expect, it } from 'vitest'
import { budgetReport, budgetSpent, clearBudget, recordSpend, ROOM_BUDGET_USD } from './budget'

describe('what a room has spent on bots', () => {
  beforeEach(clearBudget)

  it('prices input and output apart, because they cost differently', () => {
    // Haiku 4.5: $1 per million in, $5 per million out. A million of each is
    // six dollars, not two — which is the whole reason they are counted apart.
    recordSpend(1_000_000, 1_000_000)
    expect(budgetReport().spentUsd).toBeCloseTo(6, 6)
  })

  it('starts a room owing nothing', () => {
    const report = budgetReport()
    expect(report.spentUsd).toBe(0)
    expect(report.fraction).toBe(0)
    expect(budgetSpent()).toBe(false)
  })

  it('trips once the room has spent its allowance', () => {
    // Enough output tokens to clear the budget on their own.
    recordSpend(0, Math.ceil((ROOM_BUDGET_USD / 5) * 1_000_000))
    expect(budgetSpent()).toBe(true)
  })

  it('clamps the meter at full rather than reporting overshoot', () => {
    recordSpend(0, 10_000_000)
    // The bar is a bar. A fraction above 1 would draw past the end of it, and
    // overshoot is normal: the last call before the trip is still billed.
    expect(budgetReport().fraction).toBe(1)
  })

  it('ignores a negative count rather than crediting the room', () => {
    recordSpend(-5_000, -5_000)
    expect(budgetReport().spentUsd).toBe(0)
  })

  it('counts calls, so a read-out can show what the room actually did', () => {
    recordSpend(10, 10)
    recordSpend(10, 10)
    expect(budgetReport().calls).toBe(2)
  })
})
