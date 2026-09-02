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
 * nickname field carries — nine letters is the ceiling for an adjective and
 * ten for a noun, and `names.test.ts` checks every pair rather than a sample.
 *
 * **Seventy-four of each, which is 5,476 pairs.** It was twenty-four of each,
 * and 576 is small enough that a hand opening half a dozen tabs meets a repeat
 * often — and meets a repeated *adjective*, which reads as a collision even
 * when the full name differs, about half the time. Both lists stay hand-written
 * rather than generated: the point of them is that the words are the room's own
 * vocabulary, and a generator would have to be handed that list anyway.
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
  // Fifty more, because twenty-four of each is 576 pairs and a hand testing
  // with half a dozen tabs open hit a repeat often enough to notice. It is
  // 5,476 now, and the *adjective* alone repeating — which reads as a
  // collision even when the whole name differs — went from a coin flip across
  // six draws to something you can go a session without seeing.
  'Anxious',
  'Blocked',
  'Bloated',
  'Blunt',
  'Bold',
  'Bored',
  'Buggy',
  'Chatty',
  'Clean',
  'Cranky',
  'Crusty',
  'Dangling',
  'Doomed',
  'Drifting',
  'Dubious',
  'Eternal',
  'Expired',
  'Fearless',
  'Flapping',
  'Fragile',
  'Grumpy',
  'Hungover',
  'Immutable',
  'Impatient',
  'Jittery',
  'Lonely',
  'Lossy',
  'Manual',
  'Mutable',
  'Noisy',
  'Optional',
  'Panicked',
  'Patched',
  'Pending',
  'Pinned',
  'Quiet',
  'Rushed',
  'Rusty',
  'Salty',
  'Scoped',
  'Shaky',
  'Skipped',
  'Sleepy',
  'Smug',
  'Sneaky',
  'Sober',
  'Spicy',
  'Sticky',
  'Stubborn',
  'Thirsty',
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
  // The other fifty. Same subject matter and the same cap: nine letters is the
  // ceiling for an adjective and ten for a noun, which is what keeps every one
  // of the 5,476 pairs inside `NAME_MAX`. `names.test.ts` checks all of them
  // rather than a sample, for exactly the reason this list just grew.
  'Alert',
  'Backport',
  'Branch',
  'Breakpoint',
  'Buffer',
  'Bugfix',
  'Burndown',
  'Canary',
  'Changeset',
  'Checkout',
  'Cherrypick',
  'Cluster',
  'Commit',
  'Compiler',
  'Conflict',
  'Container',
  'Cutover',
  'Dashboard',
  'Deadlock',
  'Debugger',
  'Dependency',
  'Downtime',
  'Endpoint',
  'Escalation',
  'Feature',
  'Firewall',
  'Gateway',
  'Handoff',
  'Heartbeat',
  'Incident',
  'Kanban',
  'Latency',
  'Lockfile',
  'Merge',
  'Metric',
  'Namespace',
  'Onboarding',
  'Outage',
  'Patchset',
  'Payload',
  'Quota',
  'Regression',
  'Release',
  'Replica',
  'Rewrite',
  'Scrum',
  'Segfault',
  'Sunset',
  'Threshold',
  'Timeout',
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
