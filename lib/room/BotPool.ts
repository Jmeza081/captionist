import { botBrain } from '@/lib/bots/source'
import { budgetSpent } from '@/lib/bots/budget'
import { personaFor } from '@/lib/bots/personas'
import { stubBrain } from '@/lib/bots/stub'
import type { BallotCard, BotDifficulty, BotSubject, SeatedBot } from '@/lib/bots/types'
import type { ActionInput } from '@/lib/game/actions'
import { project } from '@/lib/game/project'
import { hasSubmitted, hasVoted, isRoleHolder, rankSlotCount, voteCards } from '@/lib/game/selectors'
import type { GameState, PlayerId } from '@/lib/game/types'
import { AVATAR_SEEDS } from '@/lib/avatar'
import { HAT_IDS } from '@/lib/hats'
import { suggestName } from '@/lib/names'

/**
 * The bots a host has hired, and the thing that plays them.
 *
 * **The pool acts, not the individual bot.** One model call serves every bot in
 * a phase — that is what makes a room cost cents rather than dollars, and it is
 * the only way to ask for lines that differ from each other. So the per-bot
 * dedupe state lives here, and a `BotDriver` is now just a seat.
 *
 * **Bots reach the engine directly** rather than over the transport
 * (ADR 0034). The old road sent an intent from the host's tab, out to Ably, and
 * back to the host's own engine — a round trip to reach a room it was already
 * in, for up to nineteen extra connections. What is kept is everything that
 * mattered: `apply()` still authorises, still orders, still stamps `at`, and
 * each bot still reads a *projection* rather than the host's full state.
 */

export interface BotPoolOptions {
  /** The host's engine. Bots act through it, never around it. */
  apply: (action: ActionInput, actor: PlayerId) => boolean
  snapshot: () => GameState
  /** Room time, so a bot's dwell scales with `?fast=` like everything else. */
  now: () => number
  /** Clock scale, for the same reason. */
  rate?: number
  /** Deterministic naming for tests. */
  random?: () => number
  /**
   * How the pool waits.
   *
   * Injected so a virtual-clock harness can run a whole game without spending
   * real seconds on beats that exist for people to watch. Defaults to real
   * time, which is what a room actually wants.
   */
  wait?: (ms: number) => Promise<void>
}

/**
 * The longest a brain may take, whatever the clock says.
 *
 * A ceiling on top of the phase's own remaining time rather than instead of
 * it: an untimed phase would otherwise let a hung request wait forever.
 */
const DEADLINE_CAP_MS = 15_000

/** The least time worth starting a call with. Below this, go straight to the corpus. */
const DEADLINE_FLOOR_MS = 1_500

export class BotPool {
  private readonly options: BotPoolOptions
  private readonly bots = new Map<PlayerId, SeatedBot>()
  /** One action per phase per round. Re-broadcasts must not re-submit. */
  private readonly done = new Set<string>()
  private seq = 0
  private closed = false

  constructor(options: BotPoolOptions) {
    this.options = options
  }

  /**
   * Seat a bot.
   *
   * It gets an identity the way `/join` builds one — a suggested nickname, a
   * catalogue face, a hat — rather than the seat id the harness used to hand
   * it, which rendered the literal string `bot-3` as a DiceBear seed.
   */
  add(difficulty: BotDifficulty): PlayerId | undefined {
    if (this.closed) return undefined
    const random = this.options.random ?? Math.random
    const index = ++this.seq
    // **Its own namespace.** `p${i}` collided with fixture seats and with
    // `?as=p2`, and the old guard against that was a `continue` in a loop.
    const id = `bot-${index}`

    const taken = new Set(this.options.snapshot().players.map((p) => p.name.toLowerCase()))
    let name = suggestName(random)
    // `uniqueNicknames` defaults on, so a collision is a refusal, not a
    // cosmetic problem. Five tries is plenty against 5,476 pairs.
    for (let tries = 0; taken.has(name.toLowerCase()) && tries < 5; tries += 1) {
      name = suggestName(random)
    }

    const seated: SeatedBot = { id, name, difficulty, index }
    // **The host is the actor, not the bot.** A bot joining under its own name
    // is the thing `authorize` refuses — seating one is the host's act, and
    // the payload's `id` is what becomes the player. Every action *after* this
    // is the bot's own, so the room still authorises each one against the seat
    // that is taking it.
    const accepted = this.options.apply(
      {
        type: 'player/joined',
        player: {
          id,
          name,
          avatarSeed: AVATAR_SEEDS[index % AVATAR_SEEDS.length] ?? 'critter',
          hat: HAT_IDS[index % HAT_IDS.length] ?? 'party',
          bot: difficulty,
        },
      },
      this.options.snapshot().hostId,
    )
    // A refused seat is a full room or a duplicate name. Either way the bot
    // does not exist, and must not be left in the pool acting on nothing.
    if (!accepted) return undefined

    this.bots.set(id, seated)
    return id
  }

  remove(id: PlayerId): void {
    if (!this.bots.delete(id)) return
    // A bot cannot "drop" — it has no presence entry to lose — so removal is
    // an explicit action rather than something `reconcile` will notice.
    this.options.apply({ type: 'host/botRemoved', id }, this.options.snapshot().hostId)
  }

  list(): readonly SeatedBot[] {
    return [...this.bots.values()]
  }

  has(id: PlayerId): boolean {
    return this.bots.has(id)
  }

  close(): void {
    this.closed = true
    this.bots.clear()
    this.done.clear()
  }

  /**
   * Wire to the engine's `onChange`.
   *
   * Fire-and-forget on purpose: the engine must not wait on a model, and every
   * path below either acts or gives up quietly.
   */
  observe = (state: GameState): void => {
    if (this.closed || this.bots.size === 0) return
    const key = `${state.roundNumber}:${state.phase}`
    if (this.done.has(key)) return
    // **Marked before awaiting, not after.** The old driver was synchronous, so
    // adding the key after the action was safe. With a promise in flight a
    // second broadcast would fire a second call and submit twice.
    this.done.add(key)
    void this.play(state, key)
  }

  private async play(state: GameState, key: string): Promise<void> {
    try {
      await this.act(state)
    } catch {
      // A brain that throws must not take the round with it. Every path in
      // `act` already falls back to the written-in corpus; this is the net
      // under the net, and it deliberately says nothing to any player.
      this.done.delete(key)
    }
  }

  private async act(state: GameState): Promise<void> {
    switch (state.phase) {
      case 'brief':
        return this.setSubject(state)
      case 'compose':
        return this.answer(state)
      case 'vote':
        return this.ballot(state)
      case 'tiebreak':
        return this.breakTie(state)
      default:
        return undefined
    }
  }

  /** Whichever bot holds the role this round sets it up. Nobody else. */
  private async setSubject(state: GameState): Promise<void> {
    const holder = this.list().find((bot) => isRoleHolder(state, bot.id))
    if (!holder) return

    const ctx = {
      mode: state.settings.mode,
      format: state.settings.format,
      roundNumber: state.roundNumber,
      bot: holder,
    }
    const subject = await this.withFallback(
      state,
      (brain) => brain.subject(ctx),
      () => stubBrain.subject(ctx),
    )
    await this.dwell(holder.difficulty)
    this.options.apply({ type: 'round/subjectLocked', subject }, holder.id)
  }

  /** Every bot that is competing and has not answered yet, in one call. */
  private async answer(state: GameState): Promise<void> {
    const due = this.list().filter(
      (bot) => !isRoleHolder(state, bot.id) && !hasSubmitted(state, bot.id),
    )
    if (due.length === 0) return

    const subject = this.subjectFor(state)
    if (!subject) return

    const ctx = {
      mode: state.settings.mode,
      format: state.settings.format,
      roundNumber: state.roundNumber,
      bots: due,
      subject,
    }
    const answers = await this.withFallback(
      state,
      (brain) => brain.answers(ctx),
      () => stubBrain.answers(ctx),
    )

    for (const bot of due) {
      const answer = answers.get(bot.id)
      if (!answer) continue
      await this.dwell(bot.difficulty)
      this.options.apply({ type: 'round/entrySubmitted', answer }, bot.id)
    }
  }

  /** Every bot that has not voted, in one call. */
  private async ballot(state: GameState): Promise<void> {
    const due = this.list().filter((bot) => !hasVoted(state, bot.id))
    if (due.length === 0) return

    // Cards are read for one bot and shared, which is safe because the grid is
    // the same for everybody but `own` — and a bot never ranks its own entry.
    const first = due[0]
    if (!first) return
    const cards: BallotCard[] = voteCards(state, first.id)
      .filter((card) => !card.own)
      .map((card) => ({
        entryId: card.entryId,
        text: card.lines?.join(' / ') ?? card.media?.alt ?? '',
        ...(card.media ? { media: card.media } : {}),
      }))
    if (cards.length === 0) return

    const ctx = {
      mode: state.settings.mode,
      format: state.settings.format,
      roundNumber: state.roundNumber,
      bots: due,
      voting: state.settings.voting,
      places: rankSlotCount(state, first.id),
      cards,
    }
    const ballots = await this.withFallback(
      state,
      (brain) => brain.ballots(ctx),
      () => stubBrain.ballots(ctx),
    )

    for (const bot of due) {
      const ballot = ballots.get(bot.id)
      if (!ballot) continue
      await this.dwell(bot.difficulty)
      this.options.apply({ type: 'round/ballotCast', ballot }, bot.id)
    }
  }

  /**
   * Breaking a tie needs no model.
   *
   * There are two or three contenders and no new information — a model call
   * here would spend tokens to reproduce a rotation.
   */
  private async breakTie(state: GameState): Promise<void> {
    const tiebreak = state.round?.tiebreak
    if (!tiebreak) return
    for (const bot of this.list()) {
      if (tiebreak.votes[bot.id] !== undefined) continue
      const choice = tiebreak.contenders[bot.index % tiebreak.contenders.length]
      if (!choice) continue
      await this.dwell(bot.difficulty)
      this.options.apply({ type: 'round/tiebreakVoted', choice }, bot.id)
    }
  }

  /**
   * What the round is about, as a bot may see it.
   *
   * Read through `project()` rather than off `state.round` — the projection is
   * what strips authorship, and going around it once is how a bot ends up
   * knowing something a player would not.
   */
  private subjectFor(state: GameState): BotSubject | undefined {
    const first = this.list()[0]
    if (!first) return undefined
    const subject = project(state, first.id).round?.subject
    if (!subject) return undefined
    return subject.kind === 'media'
      ? { kind: 'media', media: subject.media, ...(subject.query ? { query: subject.query } : {}) }
      : { kind: 'prompt', text: subject.text }
  }

  /**
   * Ask the model, and take the written-in corpus if it cannot answer in time.
   *
   * The deadline is the point. A provider that is merely *slow* is worse than
   * one that is down: the round sits at a gate nobody can pass until its timer
   * expires, and every player watches a tracker that never moves.
   */
  private async withFallback<T>(
    state: GameState,
    ask: (brain: ReturnType<typeof botBrain>) => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    const brain = botBrain(budgetSpent())
    if (brain.id === 'stub') return fallback()

    const budget = this.deadlineFor(state)
    // Not enough clock left to be worth asking. A model answer that arrives
    // after the gate closes is refused by `authorize` and the bot simply never
    // acts — which reads as a hung round rather than a slow one.
    if (budget < DEADLINE_FLOOR_MS) return fallback()

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        ask(brain),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('The bot brain took too long.')), budget)
        }),
      ])
    } catch {
      return fallback()
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  /**
   * How long the model gets: whatever is left on this phase, less the dwell
   * the bots still have to spend, capped.
   *
   * Derived rather than fixed because the room's clock is a host setting —
   * `capSeconds` goes down to 30, and a flat fifteen-second deadline would
   * spend half of a short round waiting for an answer that arrives too late
   * to be accepted.
   */
  private deadlineFor(state: GameState): number {
    if (state.clock.status !== 'running') return DEADLINE_CAP_MS
    const remaining = state.clock.endsAt - this.options.now()
    const rate = this.options.rate && this.options.rate > 0 ? this.options.rate : 1
    // Leave room for the slowest bot's beat, or it acts after the gate shuts.
    const dwell = personaFor('principal').delayMs / rate
    return Math.min(DEADLINE_CAP_MS, Math.max(0, remaining - dwell))
  }

  /**
   * Sit for a moment before acting.
   *
   * Bots see a broadcast the instant it lands, so without this the phase gate
   * slams shut before a person has finished reading the GIF — the room jumps
   * to the next screen and the humans never got a turn. Scaled by the room's
   * clock so `?fast=80` shortens it like everything else timed.
   */
  private dwell(difficulty: BotDifficulty): Promise<void> {
    const rate = this.options.rate && this.options.rate > 0 ? this.options.rate : 1
    const ms = personaFor(difficulty).delayMs / rate
    if (ms < 1) return Promise.resolve()
    const wait = this.options.wait
    if (wait) return wait(ms)
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
