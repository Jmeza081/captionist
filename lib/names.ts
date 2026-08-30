/**
 * A name to arrive under.
 *
 * Nobody wants to think of a nickname before they can play, and the browser
 * remembering the last one is worse than useless when the whole point of a
 * second tab is to be a second player — you end up with two Jesses in the
 * roster and no way to tell whose caption is whose. So an entry screen
 * suggests a fresh one every time and lets you type over it.
 *
 * `Adjective_Noun`, both from the room's own subject matter: the joke lands
 * before the first round does, and two people who happen to draw the same
 * adjective still differ by noun. Every pair fits the 20-character cap the
 * nickname field carries — the longest word in each list is nine letters plus
 * the separator.
 */

const ADJECTIVES: readonly string[] = [
  'Flaky',
  'Stale',
  'Silent',
  'Nervous',
  'Eager',
  'Blameless',
  'Untested',
  'Unmerged',
  'Detached',
  'Unstaged',
  'Idle',
  'Verbose',
  'Legacy',
  'Rogue',
  'Cursed',
  'Feral',
  'Hopeful',
  'Reluctant',
  'Haunted',
  'Tangled',
  'Brittle',
  'Frozen',
  'Orphaned',
  'Vintage',
] as const

const NOUNS: readonly string[] = [
  'Deploy',
  'Rollback',
  'Pipeline',
  'Standup',
  'Retro',
  'Hotfix',
  'Cache',
  'Cron',
  'Daemon',
  'Linter',
  'Migration',
  'Monolith',
  'Pager',
  'Rebase',
  'Sprint',
  'Stacktrace',
  'Postmortem',
  'Sidecar',
  'Snapshot',
  'Webhook',
  'Backlog',
  'Changelog',
  'Fixture',
  'Runbook',
] as const

/** Longest possible pair, for the test that guards the field's cap. */
export const NAME_MAX = 20

/**
 * One suggestion.
 *
 * `Math.random` rather than the room's seeded PRNG on purpose: this is a local
 * convenience picked before any room exists, not state the room has to agree
 * on — the same call `useGifSearch`'s "Surprise me" makes.
 */
export function suggestName(
  random: () => number = Math.random,
): string {
  const adjective = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)] ?? 'Flaky'
  const noun = NOUNS[Math.floor(random() * NOUNS.length)] ?? 'Deploy'
  return `${adjective}_${noun}`
}

/** Exported for the test that checks every pair fits the field. */
export const NAME_PARTS = { adjectives: ADJECTIVES, nouns: NOUNS } as const
