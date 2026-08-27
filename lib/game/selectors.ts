import { CAPTION_MAX, MIN_PLAYERS, PROMPT_MAX, RANK_POINTS } from './constants'
import type {
  Entry,
  EntryId,
  GameMode,
  GameState,
  Player,
  PlayerId,
  RoundResult,
  RoundSubject,
} from './types'

/**
 * Everything a screen renders that is a function of state.
 *
 * The rule this file exists to enforce: **all mode branching lives here.** A
 * screen never asks "is this caption mode?" — it receives already-branched
 * values. That is the design's "never fork a shared screen to add mode
 * behaviour" translated into code, and it is why fourteen designed screens
 * need only ten components.
 *
 * Several of these return *exactly* an existing molecule's prop shape. That
 * correspondence is the test that the domain model is right — when a selector
 * needs reshaping to fit a component, one of the two is wrong.
 */

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * Seven colours, twenty seats: the palette cycles.
 *
 * Re-exported from `constants.ts`, where the reducer reads it to assign a seat
 * colour at join time. One palette, one cycling rule, one place.
 */
export { colorFor } from './constants'

export function playerById(state: GameState, id: PlayerId | undefined): Player | undefined {
  if (!id) return undefined
  return state.players.find((p) => p.id === id)
}

/** The shape every player-rendering molecule takes. */
export function toAvatarProps(player: Player): Pick<Player, 'name' | 'color' | 'src'> {
  return { name: player.name, color: player.color, src: player.src }
}

export function roleHolder(state: GameState): Player | undefined {
  return playerById(state, state.round?.roleHolderId)
}

export function isRoleHolder(state: GameState, id: PlayerId): boolean {
  return state.round?.roleHolderId === id
}

/** "Captionist" or "Prompter" — the mode's name for whoever sets the round up. */
export function roleName(mode: GameMode): string {
  return mode === 'caption' ? 'Captionist' : 'Prompter'
}

export function modeName(mode: GameMode): string {
  return mode === 'caption' ? 'Caption the image' : 'React to the caption'
}

/* ------------------------------------------------------------------ */
/* Which face of a phase this viewer sees                              */
/* ------------------------------------------------------------------ */

export type ViewKey =
  | 'pick'
  | 'pickwait'
  | 'prompt'
  | 'promptwait'
  | 'caption'
  | 'submit'
  | 'watch'

/**
 * The derivation that collapses four designed screens into one phase.
 *
 * Phase is room-wide and authoritative; whether it is *your* turn is
 * per-viewer. The prototype conflates them because it has a single local
 * player. Keeping them apart is what stops `BriefScreen` forking in two.
 */
export function viewKey(state: GameState, viewerId: PlayerId): ViewKey {
  const caption = state.settings.mode === 'caption'
  const mine = isRoleHolder(state, viewerId)
  if (state.phase === 'brief') {
    if (caption) return mine ? 'pick' : 'pickwait'
    return mine ? 'prompt' : 'promptwait'
  }
  if (state.phase === 'compose') {
    // The role holder sets the round up and sits it out — they watch.
    if (mine) return 'watch'
    return caption ? 'caption' : 'submit'
  }
  return 'watch'
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

/**
 * The step names the design puts in the header, by phase.
 *
 * `brief` and `compose` are absent on purpose — their label depends on which
 * face the viewer is on, not on the phase, so they resolve through `VIEW_STEPS`.
 */
const PHASE_STEPS: Partial<Record<GameState['phase'], string>> = {
  opener: 'Get ready',
  waiting: 'Waiting',
  vote: 'Vote',
  tiebreak: 'Sudden death',
  reveal: 'Reveal',
  score: 'Scoreboard',
}

/**
 * The step names that depend on the viewer rather than the room.
 *
 * The faces that are absent — `pick`, `pickwait`, `promptwait`, `watch` — show
 * the bare round instead, which is what the design draws.
 */
const VIEW_STEPS: Partial<Record<ViewKey, string>> = {
  prompt: 'Write the prompt',
  caption: 'Caption this',
  submit: 'Answer the prompt',
}

/**
 * `AppHeader.phase` — "Round 2 of 5 · Caption this".
 *
 * Per-viewer, because the design names the step *you* are on rather than the
 * phase the room is in: the Captionist picking and everyone watching them are
 * one phase with two headers. Follows the prototype, which drops the Screens
 * doc's "Step N — " prefix.
 */
export function phaseLabel(state: GameState, viewerId: PlayerId): string | undefined {
  if (state.phase === 'lobby') return undefined
  if (state.phase === 'podium') return 'Podium'

  const round = `Round ${state.roundNumber} of ${state.settings.totalRounds}`
  const step =
    state.phase === 'brief' || state.phase === 'compose'
      ? VIEW_STEPS[viewKey(state, viewerId)]
      : PHASE_STEPS[state.phase]

  return step ? `${round} · ${step}` : round
}

/**
 * `TimerPill.suffix` — what the clock is counting down *to*.
 *
 * Empty on the waiting faces, where the design shows a bare `0:24`: you are
 * not on a deadline, someone else is.
 */
export function timerSuffix(state: GameState, viewerId: PlayerId): string {
  const view = viewKey(state, viewerId)
  if (view === 'pick') return 'to pick'
  if (view === 'prompt') return 'to write'
  if (view === 'pickwait' || view === 'promptwait') return ''
  return 'left'
}

/** The 3px header rail. The design draws it on the compose phases only. */
export function showsProgressRail(state: GameState): boolean {
  return state.phase === 'compose'
}

/** `AppHeader.settings` — mode first, so a late joiner learns the game. */
export function settingsLine(state: GameState): string {
  const s = state.settings
  return [
    modeName(s.mode),
    `${s.totalRounds} rounds`,
    `${s.capSeconds}s`,
    s.voting === 'rank' ? 'rank top 3' : 'single vote',
  ].join(' · ')
}

/** Tiebreak is always urgent, however much time is on the clock. */
export function isUrgent(state: GameState): boolean {
  return state.phase === 'tiebreak'
}

/* ------------------------------------------------------------------ */
/* Screen copy                                                         */
/* ------------------------------------------------------------------ */

/**
 * The copy each face of `BriefScreen` and `ComposeScreen` shows.
 *
 * Copy lives here for the same reason every other branch does: `BriefScreen` is
 * one component rendering four designed screens, and the moment a screen picks
 * its own strings with a ternary it has forked. The screen receives finished
 * sentences and renders them.
 */
export interface ScreenCopy {
  view: ViewKey
  /** The small accent marker above the headline. */
  eyebrow: string
  headline: string
  /** The dimmer second line the waiting faces draw under the headline. */
  headlineSecond?: string
  body?: string
  /** The one primary action, verb-first. */
  action?: string
  /** The quieter escape next to it. */
  secondary?: string
  /** What happens if the clock wins. */
  timeoutNote?: string
}

function holderName(state: GameState): string {
  return roleHolder(state)?.name ?? 'The role holder'
}

/** `BriefScreen`'s four faces — pick, prompt, and the two waits. */
export function briefCopy(state: GameState, viewerId: PlayerId): ScreenCopy {
  const view = viewKey(state, viewerId)
  const name = holderName(state)

  if (view === 'pick') {
    return {
      view,
      eyebrow: `You’re up, ${name}`,
      headline: 'Pick the GIF everyone has to suffer through.',
      action: 'Lock it in',
      secondary: 'Shuffle results',
      timeoutNote: 'If the clock runs out we’ll pick for you — and our taste is questionable.',
    }
  }

  if (view === 'prompt') {
    return {
      view,
      eyebrow: 'You’re the Prompter',
      headline: 'Write one line. Let them find the GIF.',
      body: 'No image from you this round. Everyone else answers your prompt with something they had to search for.',
      action: 'Send it to the room',
      timeoutNote: 'If the clock runs out we’ll send a starter for you.',
    }
  }

  if (view === 'promptwait') {
    return {
      view,
      eyebrow: 'Writing',
      headline: `${name} is typing a prompt.`,
      headlineSecond: 'Start warming up your search history.',
      body: 'You’ll answer it with a GIF — Giphy, or something regrettable from your screenshots folder.',
    }
  }

  return {
    view,
    eyebrow: 'Picking',
    headline: `${name} is scrolling Giphy.`,
    headlineSecond: 'Or rummaging through their screenshots.',
    body: 'Brace yourself. Last time they picked a 4-second clip of a burning server rack.',
  }
}

/** `ComposeScreen`'s three faces — caption, submit, and the role holder watching. */
export function composeCopy(state: GameState, viewerId: PlayerId): ScreenCopy {
  const view = viewKey(state, viewerId)
  const name = holderName(state)

  if (view === 'caption') {
    return {
      view,
      eyebrow: `${name} picked this`,
      headline: 'Make it hurt. Make it funny.',
      body: 'Your colleagues will rank the top three captions. Yours is anonymous until the reveal, so go ahead and roast the deploy process.',
      action: 'Submit caption',
      secondary: 'Skip this round',
    }
  }

  if (view === 'submit') {
    return {
      view,
      eyebrow: `${name}’s prompt`,
      headline: 'Answer it with a GIF.',
      body: 'Anonymous until the reveal. You can swap it until the clock runs out.',
      action: 'Lock in my answer',
    }
  }

  // The role holder set the round up and sits it out. The design never draws
  // this screen, because the prototype only ever has one local player.
  return {
    view,
    eyebrow: 'Your round',
    headline:
      state.settings.mode === 'caption'
        ? 'They’re captioning your pick.'
        : 'They’re answering your prompt.',
    body: 'You sit this one out. You still get a vote when it closes.',
  }
}

/** The compose footer — "4 of 7 have submitted". */
export function submittedLine(state: GameState): string {
  const { done, total } = submittedCount(state)
  return `${done} of ${total} have submitted`
}

/**
 * The lobby's headline and blurb.
 *
 * Two designed states — a room that can start and a room that cannot — that
 * are the same screen with different words. Branching here rather than in the
 * screen is what stops "not enough players" growing into its own component.
 */
export function lobbyCopy(state: GameState): { heading: string; body: string } {
  if (!canStart(state).ok) {
    return {
      heading: 'Two’s a code review, three’s a game.',
      body: `Captionist needs at least ${MIN_PLAYERS} players so nobody is voting for their own material. Grab one more warm body and you’re live.`,
    }
  }

  return {
    heading: 'Everybody in?',
    body:
      state.settings.mode === 'caption'
        ? 'One of you gets handed a GIF to pick, the rest fight over who captions it best. Loser buys the postmortem donuts.'
        : 'One of you gets handed a prompt to write, the rest answer it with the worst GIF they can find. Loser buys the postmortem donuts.',
  }
}

/** The prompt field's counter, mirroring `captionRemaining`. */
export function promptRemaining(text: string): number {
  return PROMPT_MAX - text.length
}

/* ------------------------------------------------------------------ */
/* Lobby                                                               */
/* ------------------------------------------------------------------ */

export type Gate = { ok: true } | { ok: false; label: string }

/**
 * "Blocked is not disabled" in one place: the control stays live and says
 * what is missing.
 */
export function canStart(state: GameState): Gate {
  const short = MIN_PLAYERS - state.players.length
  if (short > 0) {
    return { ok: false, label: `Start game — need ${short} more` }
  }
  return { ok: true }
}

/**
 * The lobby CTA's label, ready or blocked.
 *
 * One function for both lobby states so the blocked copy can never drift from
 * the live copy — "blocked is not disabled" means the label is the only place
 * the missing thing is stated.
 */
export function startLabel(state: GameState): string {
  const gate = canStart(state)
  if (!gate.ok) return gate.label
  return `Start game — ${state.players.length} players ready`
}

/* ------------------------------------------------------------------ */
/* Compose and waiting                                                 */
/* ------------------------------------------------------------------ */

/** Everyone but the role holder is competing this round. */
export function competitors(state: GameState): readonly Player[] {
  return state.players.filter((p) => !isRoleHolder(state, p.id))
}

export function myEntry(state: GameState, viewerId: PlayerId): Entry | undefined {
  return state.round?.entries.find((e) => e.authorId === viewerId)
}

export function hasSubmitted(state: GameState, viewerId: PlayerId): boolean {
  return myEntry(state, viewerId) !== undefined
}

export function hasVoted(state: GameState, viewerId: PlayerId): boolean {
  return state.round?.ballots[viewerId] !== undefined
}

export function submittedCount(state: GameState): { done: number; total: number } {
  return { done: state.round?.entries.length ?? 0, total: competitors(state).length }
}

export interface SubmissionRow {
  player: Pick<Player, 'name' | 'color' | 'src'>
  status: string
  done: boolean
}

/** `PlayerRow variant="tracker"`, verbatim. */
export function submissionRows(state: GameState): readonly SubmissionRow[] {
  return competitors(state).map((player) => {
    const done = state.round?.entries.some((e) => e.authorId === player.id) ?? false
    return {
      player: toAvatarProps(player),
      status: done ? 'submitted' : 'still writing…',
      done,
    }
  })
}

export function captionRemaining(text: string): number {
  return CAPTION_MAX - text.length
}

/* ------------------------------------------------------------------ */
/* Vote                                                                */
/* ------------------------------------------------------------------ */

export interface VoteCard {
  entryId: EntryId
  media?: { src: string; alt: string }
  lines?: readonly string[]
  /** The viewer's own entry: locked out of voting, and dimmed. */
  own: boolean
  /** 1, 2 or 3 once ranked. */
  rank?: 1 | 2 | 3
}

/**
 * The vote grid, in the seeded shuffle order.
 *
 * Mode branching happens here, once: in caption mode the shared subject is the
 * image and the entry supplies the lines; in react mode the entry *is* the
 * image. `MediaCard` receives both already resolved and never knows the mode.
 */
export function voteCards(state: GameState, viewerId: PlayerId): readonly VoteCard[] {
  const round = state.round
  if (!round) return []
  const ballot = round.ballots[viewerId]
  const ranked = ballot?.kind === 'rank' ? ballot.ranked : []
  const subject = round.subject
  const shared = subject?.kind === 'media' ? subject.media : undefined

  const byId = new Map(round.entries.map((e) => [e.id, e]))
  const order = round.order.length > 0 ? round.order : round.entries.map((e) => e.id)

  return order.flatMap((id) => {
    const entry = byId.get(id)
    if (!entry) return []
    const position = ranked.indexOf(id)
    const card: VoteCard = {
      entryId: id,
      own: entry.authorId === viewerId,
      media: entry.answer.kind === 'media' ? entry.answer.media : shared,
      lines: entry.answer.kind === 'caption' ? entry.answer.lines : undefined,
      rank: position >= 0 ? ((position + 1) as 1 | 2 | 3) : undefined,
    }
    return [card]
  })
}

export function rankedCount(state: GameState, viewerId: PlayerId): number {
  const ballot = state.round?.ballots[viewerId]
  return ballot?.kind === 'rank' ? ballot.ranked.length : ballot ? 1 : 0
}

/** The vote CTA, blocked with what is missing rather than disabled. */
export function lockGate(state: GameState, viewerId: PlayerId): Gate {
  if (state.settings.voting === 'single') {
    return rankedCount(state, viewerId) >= 1 ? { ok: true } : { ok: false, label: 'Pick one' }
  }
  const needed = Math.min(RANK_POINTS.length, Math.max(0, voteCards(state, viewerId).filter((c) => !c.own).length))
  const short = needed - rankedCount(state, viewerId)
  if (short > 0) return { ok: false, label: `Pick ${short} more` }
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Reveal, score, podium                                               */
/* ------------------------------------------------------------------ */

export function latestResult(state: GameState): RoundResult | undefined {
  return state.history[state.history.length - 1]
}

export interface RevealEntry {
  entryId: EntryId
  author?: Pick<Player, 'name' | 'color' | 'src'>
  points: number
  media?: { src: string; alt: string }
  lines?: readonly string[]
}

function revealEntry(state: GameState, id: EntryId, result: RoundResult): RevealEntry | undefined {
  const entry = state.round?.entries.find((e) => e.id === id)
  if (!entry) return undefined
  const author = playerById(state, result.authorOf[id])
  const subject = state.round?.subject
  const shared = subject?.kind === 'media' ? subject.media : undefined
  return {
    entryId: id,
    author: author ? toAvatarProps(author) : undefined,
    points: author ? (result.points[author.id] ?? 0) : 0,
    media: entry.answer.kind === 'media' ? entry.answer.media : shared,
    lines: entry.answer.kind === 'caption' ? entry.answer.lines : undefined,
  }
}

export function revealWinner(state: GameState): RevealEntry | undefined {
  const result = latestResult(state)
  if (!result) return undefined
  return revealEntry(state, result.winnerEntryId, result)
}

export function runnersUp(state: GameState): readonly RevealEntry[] {
  const result = latestResult(state)
  if (!result) return []
  return result.ranking
    .filter((id) => id !== result.winnerEntryId)
    .slice(0, 2)
    .flatMap((id) => {
      const e = revealEntry(state, id, result)
      return e ? [e] : []
    })
}

/** Running totals, folded from history — never stored twice. */
export function scoresFrom(history: readonly RoundResult[]): Record<PlayerId, number> {
  const totals: Record<PlayerId, number> = {}
  for (const result of history) {
    for (const [id, points] of Object.entries(result.points)) {
      totals[id] = (totals[id] ?? 0) + points
    }
  }
  return totals
}

export function roundWinsFrom(history: readonly RoundResult[]): Record<PlayerId, number> {
  const wins: Record<PlayerId, number> = {}
  for (const result of history) {
    const winner = result.authorOf[result.winnerEntryId]
    if (winner) wins[winner] = (wins[winner] ?? 0) + 1
  }
  return wins
}

export interface Standing {
  player: Pick<Player, 'name' | 'color' | 'src'>
  id: PlayerId
  rank: number
  score: number
  /** 0–1, this row's score as a fraction of the leader's. */
  share: number
  /** Points earned this round. */
  delta: number
  roundWins: number
}

/** `PlayerRow variant="standing"`, verbatim. */
export function standings(state: GameState): readonly Standing[] {
  const totals = scoresFrom(state.history)
  const wins = roundWinsFrom(state.history)
  const last = latestResult(state)
  const leader = Math.max(...Object.values(totals), 0)

  return state.players
    .map((player) => ({
      player: toAvatarProps(player),
      id: player.id,
      score: totals[player.id] ?? 0,
      share: leader > 0 ? (totals[player.id] ?? 0) / leader : 0,
      delta: last?.points[player.id] ?? 0,
      roundWins: wins[player.id] ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name))
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

export interface PodiumPlace {
  player: Pick<Player, 'name' | 'color' | 'src'>
  score: number
}

/** `PodiumProps`, verbatim. Third is optional in a very small room. */
export function podiumPlaces(state: GameState):
  | { first: PodiumPlace; second: PodiumPlace; third?: PodiumPlace }
  | undefined {
  const [first, second, third] = standings(state)
  if (!first || !second) return undefined
  return {
    first: { player: first.player, score: first.score },
    second: { player: second.player, score: second.score },
    third: third ? { player: third.player, score: third.score } : undefined,
  }
}

/** The score screen's CTA, which changes on the last round. */
export function nextRoundLabel(state: GameState): string {
  return state.roundNumber >= state.settings.totalRounds
    ? 'Crown the winner'
    : `Start round ${state.roundNumber + 1}`
}

export function nextRoleHolder(state: GameState): Player | undefined {
  if (state.players.length === 0) return undefined
  return state.players[(state.roleHolderIndex + 1) % state.players.length]
}

/** Narrows the round subject once, so nothing downstream has to. */
export function requireSubject(state: GameState): RoundSubject | undefined {
  return state.round?.subject ?? undefined
}
