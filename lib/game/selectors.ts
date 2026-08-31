import { CROWN } from '@/lib/hats'
import {
  CAPTION_MAX,
  HOST_FALLBACK_NAME,
  MIN_PLAYERS,
  PROMPT_MAX,
  RANK_POINTS,
  ROUNDS_MAX,
  SEAT_GRACE_MS,
  roundsMaxFor,
} from './constants'
import type {
  Ballot,
  ConnectionState,
  Entry,
  EntryId,
  GameMode,
  GameState,
  MediaRef,
  Player,
  PlayerFace,
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

/**
 * Who is leading, for the crown.
 *
 * **Nobody, until somebody has scored.** `standings()` sorts by score and then
 * by name, so its first row at 0–0 is whoever is alphabetically first —
 * crowning them would be the scoreboard's tiebreak leaking out as a claim
 * about the game. A crown is earned: no history, no crown; no positive score,
 * no crown.
 *
 * **Everyone level at the top wears one.** A crown for the sole leader blinks
 * out after any round that levels two players, which in a small room is most
 * of them, and a crown that vanishes reads as a bug where two crowns read as a
 * tie.
 *
 * Memoised on `state.history`, which is a stable reference between rounds:
 * `standings()` calls `toAvatarProps` once per player, and without this a
 * twenty-player scoreboard would fold the whole history twenty times per
 * render. Same argument as the cache in `lib/avatar.ts`.
 */
const LEADERS = new WeakMap<readonly RoundResult[], ReadonlySet<PlayerId>>()

export function leaderIds(state: GameState): ReadonlySet<PlayerId> {
  const cached = LEADERS.get(state.history)
  if (cached) return cached

  const totals = scoresFrom(state.history)
  const top = Math.max(0, ...Object.values(totals))
  const leaders = new Set<PlayerId>(
    top > 0 ? Object.keys(totals).filter((id) => totals[id] === top) : [],
  )
  LEADERS.set(state.history, leaders)
  return leaders
}

/**
 * The shape every player-rendering molecule takes.
 *
 * `avatarSeed` rides along because the art is derived at the edge: the seed is
 * what `GameState` carries, and `Avatar` turns it into a face locally. Nothing
 * upstream ever holds the rendered SVG.
 *
 * **`state` is required, and that is the point.** The crown is where the room
 * stands drawn on a face, so it has to be resolved somewhere that can see the
 * room — and resolving it *here*, at the one place a `Player` becomes
 * something drawable, means no screen has to know the rule and no state has to
 * remember it. Making the parameter optional would have turned "did I remember
 * to crown here?" into a question; required, it is a compile error.
 */
export function toAvatarProps(state: GameState, player: Player): PlayerFace {
  return {
    name: player.name,
    color: player.color,
    src: player.src,
    // Beats the hat you picked for exactly as long as you lead, and is not
    // stored anywhere: lose the lead and your own hat is simply back.
    hat: leaderIds(state).has(player.id) ? CROWN : player.hat,
    avatarSeed: player.avatarSeed,
  }
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
  /** Your entry is in and the room's clock is still running. */
  | 'submitted'
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
    // **Submitting ends your round, not the room's.** The composer used to
    // stay put with a snackbar, which read as nothing having happened and
    // quietly offered a rewrite — and a caption you can keep editing until the
    // clock dies is a different game from one where the joke you commit to is
    // the joke you are judged on. The phase is still room-wide; this is the
    // per-viewer face of it, the same split `pick`/`pickwait` is.
    if (hasSubmitted(state, viewerId)) return 'submitted'
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
  // The room is still composing; you are not.
  submitted: 'Waiting',
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
    `${s.totalRounds} ${s.totalRounds === 1 ? 'round' : 'rounds'}`,
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
      secondary: 'Surprise me',
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
    headline: `${name} is scrolling for a GIF.`,
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
      body: 'Your colleagues will rank the top three captions. Yours is anonymous until the reveal, so go ahead and roast the deploy process. You get one shot — submitting is final.',
      action: 'Submit caption',
      secondary: 'Skip this round',
    }
  }

  if (view === 'submit') {
    return {
      view,
      eyebrow: `${name}’s prompt`,
      headline: 'Answer it with a GIF.',
      body: 'Anonymous until the reveal. You get one shot — locking it in is final.',
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

/** One caption input on the compose screen. */
export interface CaptionField {
  label: string
  placeholder: string
  /** The design gives the first field the accent focus ring. */
  primary: boolean
}

/**
 * The caption inputs the room's format asks for.
 *
 * `format` is a setting the screen has to *honour*, not merely summarise — a
 * one-line room writes one caption. Nothing downstream moves: the answer is
 * already `{ kind: 'caption'; lines: readonly string[] }`, and every card reads
 * `lines?.[0]` / `lines?.[1]`, so a missing second line simply draws no bottom
 * overlay.
 */
export function captionFields(state: GameState): readonly CaptionField[] {
  if (state.settings.format === 'one') {
    return [
      { label: 'Caption', placeholder: 'When prod goes down on a Friday…', primary: true },
    ]
  }
  return [
    { label: 'Top text', placeholder: 'When prod goes down…', primary: true },
    { label: 'Bottom text', placeholder: '…and I’m the only one on call', primary: false },
  ]
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
export function lobbyCopy(
  state: GameState,
  viewerId?: PlayerId,
): { heading: string; body: string } {
  // The guest lobby answers the two questions a waiting player actually has —
  // am I in, and who is holding things up — rather than the host's "shall we
  // start". Same screen, different words, which is the rule everywhere else.
  const you = viewerId ? playerById(state, viewerId) : undefined
  if (you && !you.isHost) {
    const host = state.players.find((p) => p.isHost)
    // A host who never named themselves is "the host" here, not their
    // placeholder — the sentence is about them in the third person.
    const who =
      host && host.name && host.name !== HOST_FALLBACK_NAME ? host.name : 'The host'
    return {
      heading: `You’re in, ${you.name}.`,
      body: `${who} is still herding the rest of the team. Stretch your typing fingers.`,
    }
  }

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
  player: PlayerFace
  status: string
  done: boolean
}

/** `PlayerRow variant="tracker"`, verbatim. */
export function submissionRows(state: GameState): readonly SubmissionRow[] {
  return competitors(state).map((player) => {
    const done = state.round?.entries.some((e) => e.authorId === player.id) ?? false
    return {
      player: toAvatarProps(state, player),
      status: done ? 'submitted' : 'still thinking',
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
  media?: MediaRef
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
  // A cast single vote is a one-long ranking as far as the grid is concerned:
  // the card it names still wears the ring and still fills the one slot. Read
  // only the `rank` kind here and a locked single-vote room draws nothing.
  const ranked = ballot?.kind === 'rank' ? ballot.ranked : ballot ? [ballot.choice] : []
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

/**
 * The vote CTA against the *committed* ballot.
 *
 * `VoteScreen` ranks locally and asks `lockGateFrom` with its draft instead —
 * both roads lead to the same function so the two labels cannot drift.
 */
export function lockGate(state: GameState, viewerId: PlayerId): Gate {
  return lockGateFrom(state, viewerId, rankedCount(state, viewerId))
}

/* ------------------------------------------------------------------ */
/* Reveal, score, podium                                               */
/* ------------------------------------------------------------------ */

export function latestResult(state: GameState): RoundResult | undefined {
  return state.history[state.history.length - 1]
}

export interface RevealEntry {
  entryId: EntryId
  author?: PlayerFace
  points: number
  media?: MediaRef
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
    author: author ? toAvatarProps(state, author) : undefined,
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
  player: PlayerFace
  id: PlayerId
  rank: number
  score: number
  /** 0–1, this row's score as a fraction of the leader's. */
  share: number
  /** Points earned this round. */
  delta: number
  roundWins: number
  /** The right-hand column — rounds won once there are any, else this round's delta. */
  note: string
}

/** `PlayerRow variant="standing"`, verbatim. */
export function standings(state: GameState): readonly Standing[] {
  const totals = scoresFrom(state.history)
  const wins = roundWinsFrom(state.history)
  const last = latestResult(state)
  const leader = Math.max(...Object.values(totals), 0)

  return state.players
    .map((player) => ({
      player: toAvatarProps(state, player),
      id: player.id,
      score: totals[player.id] ?? 0,
      share: leader > 0 ? (totals[player.id] ?? 0) / leader : 0,
      delta: last?.points[player.id] ?? 0,
      roundWins: wins[player.id] ?? 0,
      note: standingNote(wins[player.id] ?? 0, last?.points[player.id] ?? 0),
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name))
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

export interface PodiumPlace {
  player: PlayerFace
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

/* ------------------------------------------------------------------ */
/* Phase 3 copy                                                        */
/* ------------------------------------------------------------------ */

/**
 * The six round-flow screens' strings.
 *
 * Same rule as `briefCopy` and `composeCopy`, and the same reason: each of
 * these screens renders both modes, so the moment one picks its own words with
 * a ternary it has forked. They take dedicated shapes rather than `ScreenCopy`
 * because none of them has a `ViewKey` — every phase here resolves to `watch`,
 * which would be a field that means nothing.
 */

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** 1st, 2nd, 3rd, 4th — for placements and rank slots. */
export function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** "Jack and Lukasz", "Jack, Lukasz and Vic". */
function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/* ---------------- Waiting ---------------- */

export interface WaitingCopy {
  eyebrow: string
  headline: string
  body: string
  /** The pill over your own card. */
  locked: string
  trackerLabel: string
  /**
   * Host-only, and only while somebody is still out: ending the wait early is
   * the same code path as the clock. Absent once everyone is in — see below.
   */
  action?: string
}

/**
 * The design's "Edit my caption" is deliberately absent.
 *
 * Phase is room-wide and authoritative, so a guest cannot rewind the room to
 * `compose` — and an inline editor here would be a second composer to keep in
 * step with the real one. The body is rewritten to match: it states what
 * happens next rather than promising an edit that isn't offered.
 */
export function waitingCopy(state: GameState): WaitingCopy {
  const react = state.settings.mode === 'react'
  const out = competitors(state).filter((p) => !hasSubmitted(state, p.id))

  /**
   * Everyone is in, so there is no wait and no decision.
   *
   * The screen used to say "now we wait" over a tracker reading N of N, under
   * a twelve-second clock, beside a host button offering to start voting —
   * four ways of announcing the same finished fact. The reducer shortens the
   * clock to `WAITING_ALL_IN_MS` here, so this is a beat you read rather than
   * a wait you sit out, and the button is gone with the wait it was ending.
   */
  if (out.length === 0) {
    return {
      eyebrow: react ? 'Answer locked' : 'Submitted',
      headline: 'That’s everyone in.',
      body: react
        ? 'Voting opens in a second. Every answer goes up anonymously.'
        : 'Voting opens in a second. Every caption goes up anonymously, and the roasting begins.',
      locked: 'Locked in',
      trackerLabel: 'Submissions',
    }
  }

  return {
    eyebrow: react ? 'Answer locked' : 'Submitted',
    headline: react ? 'Bold choice. Now we wait.' : 'Nice one. Now we wait.',
    body: react
      ? 'It goes up anonymously next to everyone else’s when the clock hits zero.'
      : 'It goes up anonymously when the clock hits zero, and the roasting begins.',
    locked: 'Locked in',
    trackerLabel: 'Submissions',
    /**
     * What the button actually does, which is leave people behind.
     *
     * It read "Everyone's in — start voting" unconditionally, and `waiting` is
     * reachable with stragglers — the compose clock expiring sends the room
     * here whoever is still typing. So the host was told everyone was in by a
     * button sitting directly under a tracker saying they were not.
     */
    action:
      out.length === 1
        ? `Start voting without ${out[0]?.name ?? 'them'}`
        : `Start voting without ${out.length} players`,
  }
}

/* ---------------- Vote ---------------- */

export interface VoteCopy {
  heading: string
  subline: string
  /** "7 submissions · shuffled so nobody games the order". */
  meta: string
  picksLabel: string
  /** The scrim over your own entry — a caption in one mode, an answer in the other. */
  ownLabel: string
  /** The card's button while nothing is chosen. */
  pickAction: string
  /** The dock button, and what it reads once the ballot is cast. */
  lockAction: string
  lockedLabel: string
  /**
   * What the one slot is called in a single-vote room.
   *
   * A ranking room numbers its slots with `ordinal`. "1st" is meaningless when
   * there is nothing for it to come before, so single voting names the slot
   * instead of placing it.
   */
  slotLabel?: string
}

export function voteCopy(state: GameState): VoteCopy {
  const react = state.settings.mode === 'react'
  const single = state.settings.voting === 'single'
  const count = state.round?.entries.length ?? 0
  const anonymity = react
    ? 'Answers are anonymous until the reveal.'
    : 'You can’t vote for your own — we checked.'

  return {
    heading: single ? 'Pick the best one.' : 'Rank your top three.',
    subline: single
      ? `1 point to whoever you pick. ${anonymity}`
      : `3 points for first, 2 for second, 1 for third. ${anonymity}`,
    meta: `${plural(count, 'submission', 'submissions')} · shuffled so nobody games the order`,
    picksLabel: single ? 'Your pick' : 'Your picks',
    ownLabel: react ? 'Your own answer' : 'Your own caption',
    pickAction: single ? 'Pick this' : 'Rank this',
    lockAction: single ? 'Lock my pick' : 'Lock my ranking',
    lockedLabel: single ? 'Pick locked in' : 'Ranking locked in',
    slotLabel: single ? 'Picked' : undefined,
  }
}

/**
 * What the card's button says once it is the one you chose.
 *
 * A function rather than a string on `VoteCopy`, because the ranking room's
 * label names the place it frees — "Clear 2nd" — and the single-vote room has
 * no place to name. Composing that in the screen would be a copy branch on a
 * screen, which is the one thing this file exists to prevent.
 */
export function clearLabel(state: GameState, place: 1 | 2 | 3): string {
  return state.settings.voting === 'single' ? 'Clear pick' : `Clear ${ordinal(place)}`
}

/**
 * How many places this room can actually rank.
 *
 * A three-player room has two entries and one voter who authored neither, so
 * asking for three would be a gate nobody could pass. A single-vote room has
 * exactly one slot whatever the roster — the setting is the cap, not the
 * arithmetic.
 */
export function rankSlotCount(state: GameState, viewerId: PlayerId): number {
  const others = voteCards(state, viewerId).filter((c) => !c.own).length
  const places = state.settings.voting === 'single' ? 1 : RANK_POINTS.length
  return Math.min(places, Math.max(0, others))
}

/**
 * The ballot a draft becomes, in the shape this room actually scores.
 *
 * Here rather than in `VoteScreen` because two callers build a ballot — the
 * screen and `fixtures.ts` — and they disagreed: both hardcoded `kind: 'rank'`,
 * so a single-vote room paid `RANK_POINTS[0]` (3) for a one-long ranking where
 * the reducer's single branch pays 1. Branch the values in one place and the
 * two roads cannot drift again.
 */
export function ballotFrom(
  state: GameState,
  ranked: readonly EntryId[],
): Ballot | undefined {
  const choice = ranked[0]
  if (choice === undefined) return undefined
  if (state.settings.voting === 'single') return { kind: 'single', choice }
  return { kind: 'rank', ranked }
}

/**
 * The lock gate against an arbitrary count.
 *
 * `VoteScreen` holds its ranking as local draft state — casting a ballot per
 * tap would trip the reducer's "everyone has voted" check and tally the round
 * halfway through. So the gate has to be answerable from the draft, not only
 * from the committed ballot.
 */
export function lockGateFrom(state: GameState, viewerId: PlayerId, ranked: number): Gate {
  if (state.settings.voting === 'single') {
    return ranked >= 1 ? { ok: true } : { ok: false, label: 'Pick one' }
  }
  const short = rankSlotCount(state, viewerId) - ranked
  if (short > 0) return { ok: false, label: `Pick ${short} more` }
  return { ok: true }
}

/* ---------------- Tiebreak ---------------- */

export interface TiebreakCard {
  entryId: EntryId
  author?: PlayerFace
  media?: MediaRef
  lines?: readonly string[]
  /** Contenders cannot vote in their own duel. */
  own: boolean
}

/**
 * The duel, mirroring `voteCards`.
 *
 * This is the one screen before the reveal that names people: a head-to-head
 * cannot be anonymous, and the authors come from `tiebreak.pending.authorOf`,
 * which `project.ts` narrows to exactly these contenders.
 */
export function tiebreakCards(state: GameState, viewerId: PlayerId): readonly TiebreakCard[] {
  const round = state.round
  const tiebreak = round?.tiebreak
  if (!round || !tiebreak) return []
  const subject = round.subject
  const shared = subject?.kind === 'media' ? subject.media : undefined
  const byId = new Map(round.entries.map((e) => [e.id, e]))

  return tiebreak.contenders.flatMap((id) => {
    const entry = byId.get(id)
    if (!entry) return []
    const authorId = tiebreak.pending.authorOf[id]
    const author = playerById(state, authorId)
    return [
      {
        entryId: id,
        author: author ? toAvatarProps(state, author) : undefined,
        media: entry.answer.kind === 'media' ? entry.answer.media : shared,
        lines: entry.answer.kind === 'caption' ? entry.answer.lines : undefined,
        own: authorId === viewerId,
      },
    ]
  })
}

export function hasTiebreakVoted(state: GameState, viewerId: PlayerId): boolean {
  return state.round?.tiebreak?.votes[viewerId] !== undefined
}

export interface TiebreakCopy {
  eyebrow: string
  headline: string
  body: string
  /** "4 of 7 have voted". */
  voteLine: string
  /** "Jack and Lukasz can’t vote in their own duel". */
  exclusionLine: string
  action: string
}

export function tiebreakCopy(state: GameState): TiebreakCopy {
  const tiebreak = state.round?.tiebreak
  // Every tied entry scored the same — that is what a dead heat is — so the
  // first contender's author speaks for all of them.
  const first = tiebreak?.contenders[0]
  const author = first ? tiebreak?.pending.authorOf[first] : undefined
  const points = author ? (tiebreak?.pending.points[author] ?? 0) : 0
  const voted = Object.keys(tiebreak?.votes ?? {}).length
  const names = (tiebreak?.contenders ?? []).flatMap((id) => {
    const player = playerById(state, tiebreak?.pending.authorOf[id])
    return player ? [player.name] : []
  })

  return {
    eyebrow: `Dead heat — ${plural(points, 'point', 'points')} each`,
    headline: 'Somebody has to break this tie.',
    body: `One vote each. No abstaining, no diplomacy. The ${roleName(
      state.settings.mode,
    )} gets the deciding vote if it’s still level.`,
    voteLine: `${voted} of ${state.players.length} have voted`,
    exclusionLine: names.length > 0 ? `${nameList(names)} can’t vote in their own duel` : '',
    action: 'Vote this one',
  }
}

/* ---------------- Reveal ---------------- */

export interface RevealCopy {
  eyebrow: string
  headline: string
  /** "14 ranking points this round". */
  winnerSub: string
  /** "+3", beside the winner. */
  winnerPoints: string
  runnersUpLabel: string
  reactLabel: string
  action: string
  /** The phone-only row — "You finished 4th this round". */
  placement?: string
}

export function revealCopy(state: GameState, viewerId: PlayerId): RevealCopy {
  const react = state.settings.mode === 'react'
  const result = latestResult(state)
  const winner = revealWinner(state)
  const name = winner?.author?.name ?? 'Nobody'
  // By id, not by name: `uniqueNicknames` is a setting, so two Jesses are legal.
  const mine = result !== undefined && result.authorOf[result.winnerEntryId] === viewerId
  const points = winner?.points ?? 0

  return {
    eyebrow: react ? `Round ${state.roundNumber} · best answer` : `Round ${state.roundNumber} winner`,
    // "Legend" when it's you, "monster" when it isn't — the design's own joke.
    headline: mine ? `${name}, you legend.` : `${name}, you monster.`,
    // "Ranking points" names a mechanism a single-vote room does not have —
    // there, a point is one person choosing you.
    winnerSub:
      state.settings.voting === 'single'
        ? `${plural(points, 'vote', 'votes')} this round`
        : `${plural(points, 'ranking point', 'ranking points')} this round`,
    winnerPoints: `+${points}`,
    runnersUpLabel: 'Runners up',
    reactLabel: 'React',
    action: 'See the scoreboard',
    placement: myRoundPlacement(state, viewerId),
  }
}

/** Where this viewer's entry finished, for the reveal's phone layout. */
export function myRoundPlacement(state: GameState, viewerId: PlayerId): string | undefined {
  const result = latestResult(state)
  if (!result) return undefined
  const mine = result.ranking.findIndex((id) => result.authorOf[id] === viewerId)
  if (mine < 0) return undefined
  return `You finished ${ordinal(mine + 1)} this round`
}

/**
 * The five one-tap reactions from the design.
 *
 * Re-exported rather than redeclared: the room's whole reaction set lives in
 * `lib/reactions.ts` now that the picker, the composer and this bar all read
 * it, and two hand-kept copies of a list are one copy too many.
 */
export { REVEAL_REACTIONS } from '@/lib/reactions'

/* ---------------- Score ---------------- */

export interface ScoreCopy {
  heading: string
  subhead: string
  /** "Next captionist: Jesska", or "Last round done". */
  nextRoleLine: string
  action: string
}

export function scoreCopy(state: GameState): ScoreCopy {
  const [leader] = standings(state)
  const last = state.roundNumber >= state.settings.totalRounds
  const next = nextRoleHolder(state)
  const role = roleName(state.settings.mode).toLowerCase()

  return {
    heading: 'Standings',
    subhead: leader
      ? `${leader.player.name} has taken the lead and is being unbearable about it.`
      : 'Nobody has scored yet. Awkward.',
    nextRoleLine: last ? 'Last round done' : next ? `Next ${role}: ${next.name}` : '',
    action: nextRoundLabel(state),
  }
}

/** The header's round pips. The design draws them on the scoreboard only. */
export function showsRoundProgress(state: GameState): boolean {
  return state.phase === 'score'
}

/** The right-hand column of a standings row. */
function standingNote(roundWins: number, delta: number): string {
  if (roundWins > 0) return plural(roundWins, 'round won', 'rounds won')
  return `+${delta} this round`
}

/* ---------------- Podium ---------------- */

export interface PodiumCopy {
  /** "Game over · 5 rounds", for the header. */
  gameOverLabel: string
  eyebrow: string
  headline: string
  body: string
  action: string
  /**
   * Set when the action is a navigation rather than a room command.
   *
   * A room that ended because its host left has no host to restart it, so
   * "Rematch" would be a button that could only ever refuse.
   */
  actionHref?: string
  secondary: string
}

export function podiumCopy(state: GameState): PodiumCopy {
  const [champion] = standings(state)
  const name = champion?.player.name ?? 'Nobody'
  // The podium is also where a room lands when its host closes the tab — the
  // room ends with them (ADR 0003), and until now that arrived as a scoreboard
  // with no explanation. The design draws no screen for it, so the honest
  // minimum is for this one to say what happened.
  const early = state.roundNumber < state.settings.totalRounds

  if (early) {
    return {
      gameOverLabel: `Ended early · round ${state.roundNumber} of ${state.settings.totalRounds}`,
      eyebrow: 'The host left',
      headline: 'That’s the game, then.',
      body: 'The room lives in the host’s browser, so it goes when they do. Standings as they stood.',
      action: 'Start a new room',
      actionHref: '/host',
      secondary: 'Back to the start',
    }
  }

  return {
    gameOverLabel: `Game over · ${plural(state.settings.totalRounds, 'round', 'rounds')}`,
    // Fixed in both modes — the prototype does not branch it, and "Prompter of
    // the sprint" would rename the product rather than the role.
    eyebrow: 'Captionist of the sprint',
    headline: `${name} takes the crown.`,
    body: champion
      ? `${plural(champion.score, 'point', 'points')}, ${plural(
          champion.roundWins,
          'round won',
          'rounds won',
        )}, and zero remorse.`
      : 'Five rounds and nothing to show for it.',
    action: 'Rematch with the same crew',
    secondary: 'Back to the start',
  }
}

/* ------------------------------------------------------------------ */
/* Phase 4 — the screens that run before a room exists                 */
/* ------------------------------------------------------------------ */

/**
 * `/join` and `/host` have no `GameState` to read: they are what happens
 * *before* a room exists. Their copy still lives here, for the same reason
 * every other screen's does — so the words are in a file a node test can reach
 * and the screen is left holding markup.
 */

export interface JoinCopy {
  heading: string
  body: string
  faceLabel: string
  hatLabel: string
  hatBody: string
  nicknameLabel: string
  nicknamePlaceholder: string
  action: string
  /** The way out for someone who arrived before the host did. */
  secondary: string
  helper: string
}

export function joinCopy(): JoinCopy {
  return {
    heading: 'Got a room code?',
    body: 'Ask whoever is sharing their screen.',
    faceLabel: 'Pick your face',
    hatLabel: 'Your hat',
    hatBody:
      'Sits on your avatar all game. The crown goes to whoever is winning; this one is just yours.',
    nicknameLabel: 'Nickname',
    nicknamePlaceholder: 'What should we call you?',
    action: 'Join the room',
    secondary: 'Make your own',
    helper: 'Codes are 7 characters and always start with C',
  }
}

/**
 * Why a join did not work.
 *
 * The design draws no error state on the join screen at all, so these are the
 * app's. Two already existed and are reused rather than reworded — a second
 * sentence for the same failure is how copy drifts.
 */
export const JOIN_ERRORS = {
  /** Already in `LandingActions`, for a code that is not a code. */
  malformed: 'That isn’t a room code. Check the one on the shared screen.',
  /**
   * The genuinely new one: the code is well-formed and nobody is hosting it.
   * It offers the way out the design's own join screen already draws.
   */
  empty: 'Nobody is hosting that room. Check the code, or start your own.',
  /** Needs a nickname before it can ask for a seat. */
  noName: 'Pick a name first',
} as const

export interface HostSetupCopy {
  heading: string
  /** One line under the heading, in the shape `JoinCopy` uses. */
  body: string
  hostSection: string
  /** The hat picker's own heading and the line under it. */
  hatLabel: string
  hatBody: string
  modeSection: string
  modeBody: string
  modeHelp: string
  settingsSection: string
  gifSearchLabel: string
  uniqueLabel: string
  formatLabel: string
  votingLabel: string
  capLabel: string
  roomSizeLabel: string
  roundsLabel: string
  action: string
}

/**
 * Why the rounds stepper stops where it does.
 *
 * Said under the control rather than discovered by pushing against it: the
 * bound moves with the room size, and a stepper that silently refuses is a
 * stepper people assume is broken. Rule 10's reasoning applied to a bound
 * instead of a button.
 */
export function roundsHint(maxPlayers: number, totalRounds: number): string {
  const max = roundsMaxFor(maxPlayers)
  if (totalRounds < max) return `Up to ${max} at this room size.`
  if (max === ROUNDS_MAX) return 'The most the room plays.'
  return `The most ${maxPlayers} players fit in the free GIF allowance.`
}

export function hostSetupCopy(): HostSetupCopy {
  return {
    heading: 'New game room',
    // The design's own note about this screen, in the room's own voice:
    // nothing here is required, so a host who reads none of it still gets a
    // working game.
    body: 'Pick your chaos. Or don’t, I’m not your boss.',
    hostSection: 'Host info',
    hatLabel: 'Host hat',
    hatBody:
      'Sits on your avatar all game. The crown goes to whoever is winning; this one is just yours.',
    modeSection: 'Game mode',
    modeBody: 'Who supplies the image, and who supplies the words.',
    modeHelp: 'How this mode works',
    settingsSection: 'Room settings',
    gifSearchLabel: 'Let the picked player search for a GIF',
    uniqueLabel: 'Enforce unique nicknames',
    formatLabel: 'Caption format',
    votingLabel: 'Voting',
    capLabel: 'Submission time limit',
    roomSizeLabel: 'Room size',
    roundsLabel: 'Number of rounds',
    action: 'Open the room',
  }
}

/** The two mode cards on `/host`, in the design's own words. */
export interface ModeChoice {
  mode: GameMode
  title: string
  body: string
  /** `CLASSIC` / `REVERSED` until picked, then `SELECTED`. */
  tag: string
}

export function modeChoices(selected: GameMode): readonly ModeChoice[] {
  return [
    {
      mode: 'caption',
      title: 'Caption the image',
      body: 'One player picks a GIF. Everyone else writes the caption.',
      tag: selected === 'caption' ? 'Selected' : 'Classic',
    },
    {
      mode: 'react',
      title: 'React to the caption',
      body: 'One player writes a prompt. Everyone else answers with a GIF.',
      tag: selected === 'react' ? 'Selected' : 'Reversed',
    },
  ]
}

/** The design's caption-format row is hidden in react mode — a value, not a fork. */
export function showsCaptionFormat(mode: GameMode): boolean {
  return mode === 'caption'
}

export interface SettingsPair {
  label: string
  value: string
}

/**
 * The guest lobby's read-only settings.
 *
 * A guest cannot change the rules the host set, so they are shown rather than
 * offered. Four pairs, which is what the design draws — and the same facts
 * `settingsLine` puts in the host's header, laid out to be read rather than
 * skimmed.
 */
export function settingsSummary(state: GameState): readonly SettingsPair[] {
  const s = state.settings
  return [
    { label: 'Rounds', value: String(s.totalRounds) },
    { label: 'Caption time', value: `${s.capSeconds} sec` },
    { label: 'Format', value: s.format === 'tb' ? 'Top + bottom' : 'One line' },
    { label: 'Voting', value: s.voting === 'rank' ? 'Rank your top 3' : 'Single vote' },
  ]
}

/**
 * The guest lobby's status line, under the roster.
 *
 * Leads with the substring the phase-2 spec already asserts, because that
 * assertion is the guarantee a guest is never handed the host's button.
 */
export const WAITING_LINE =
  'Waiting on the host to start · you can change your avatar until then'

/* ------------------------------------------------------------------ */
/* Presence                                                            */
/* ------------------------------------------------------------------ */

/**
 * How many people are actually here.
 *
 * Not `players.length`. A seat is *held* when someone drops — deliberately, so
 * a mid-round disconnect does not destroy their submission or renumber the role
 * rotation — which means the roster keeps counting them. "7 here" was therefore
 * "7 seats exist", and stayed 7 after everyone had closed their laptops.
 */
export function presentCount(state: GameState): number {
  return state.players.filter((p) => p.connection === 'online').length
}

/**
 * What has become of a dropped seat, given the clock.
 *
 * `seatHeldUntil` was written by the reducer and read by nothing, so the grace
 * window was recorded and never enforced — a held seat was held forever. This
 * is the rule that makes `'gone'` reachable at all: it is the one
 * `ConnectionState` no action produces, because it is not an event that happens
 * to a player, it is a deadline passing.
 */
export function seatState(player: Player, now: number): ConnectionState {
  if (player.connection !== 'reconnecting') return player.connection
  if (player.seatHeldUntil === undefined) return 'reconnecting'
  return now >= player.seatHeldUntil ? 'gone' : 'reconnecting'
}

/** How long this player has left to come back, in whole seconds. */
export function seatSecondsLeft(player: Player, now: number): number {
  if (player.seatHeldUntil === undefined) return 0
  return Math.max(0, Math.ceil((player.seatHeldUntil - now) / 1_000))
}

/* ------------------------------------------------------------------ */
/* Dropped                                                             */
/* ------------------------------------------------------------------ */

export interface ReconnectCopy {
  headline: string
  body: string
  /**
   * "Reconnecting…" — the client is already trying, without being asked.
   *
   * The design writes "attempt 3" here. We do not show a number: the transport
   * retries internally and reports no count, so any figure would be one this
   * component invented from a timer. Same reasoning that dropped the reveal's
   * "auto-advancing in 6s" — a label with nothing behind it is worse than none.
   */
  attempt: string
  /** "38s until you're dropped". */
  countdown: string
  /** "Vic · 11 points · 4th place". */
  identity: string
  /** "Room C-F34213 · round 2 of 5". */
  where: string
  action: string
  secondary: string
}

/**
 * What a dropped player is told.
 *
 * The design's point, in its own note: a dropped player "sees their state
 * preserved and a single rejoin action rather than a lost game". So all three
 * facts it states are true rather than reassuring — the seat really is held for
 * `SEAT_GRACE_MS`, the entry really does survive, and the score is folded from
 * `history` which nothing has touched.
 */
export function reconnectCopy(
  state: GameState,
  viewerId: PlayerId,
  secondsLeft: number,
  held: boolean,
): ReconnectCopy {
  const you = playerById(state, viewerId)
  const row = standings(state).find((s) => s.id === viewerId)
  const saved =
    myEntry(state, viewerId) !== undefined
      ? ` and your entry for round ${state.roundNumber} is already saved`
      : ''

  return {
    headline: 'Connection dropped.',
    // Only promise a held seat when the host is there to hold one. If the host
    // is what vanished there is no grace window, and saying otherwise would be
    // a countdown against a clock nobody is keeping.
    body: held
      ? `Your seat is held for ${Math.round(SEAT_GRACE_MS / 1_000)} seconds${saved}. Your points aren’t going anywhere.`
      : `Nothing is lost${saved}. Your points are still yours — the room just cannot hear you.`,
    attempt: 'Reconnecting…',
    countdown: `${secondsLeft}s until you’re dropped`,
    identity: row
      ? `${row.player.name} · ${plural(row.score, 'point', 'points')} · ${ordinal(row.rank)} place`
      : (you?.name ?? 'You'),
    where:
      state.round !== null
        ? `Room ${state.roomCode} · round ${state.roundNumber} of ${state.settings.totalRounds}`
        : `Room ${state.roomCode}`,
    action: 'Rejoin now',
    secondary: 'Leave the game instead',
  }
}
