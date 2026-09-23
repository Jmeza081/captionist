'use client'

import { CUES, type CueId } from './catalog'
import { readSoundPrefs } from './preferences'
import { sameMusic, type Bed } from './soundtrack'

/**
 * The one `AudioContext` on the page, and everything plugged into it.
 *
 * **A module, not a component.** It has to outlive a route change: a guest's
 * last gesture is the tap on `/join`, and `router.push` into the room is a soft
 * navigation, so a context unlocked inside that tap is still unlocked when the
 * room mounts. A context owned by a component would be born in the room,
 * after the gesture had gone.
 *
 * **Buffers, not `<audio>`.** A media element leaves a gap at the loop point
 * and cannot start two sounds on the same sample; an `AudioBufferSourceNode`
 * does both. The cost is memory — a decoded buffer is uncompressed — so only
 * the beds actually playing are kept, and the longest is seventy seconds.
 *
 * Signal path: each bed → its own gain → music bus → duck → out, and every
 * one-shot → sfx bus → out. The duck is what dips the music under a sting.
 */

/**
 * `starting` is the beat between making a context and the browser deciding
 * about it. Every context is born suspended, including the ones the browser is
 * about to allow — so reading "suspended" straight away would flash "your
 * browser blocked sound" at people whose browser did no such thing.
 */
export type EngineState = 'off' | 'starting' | 'suspended' | 'running'

export interface EngineSnapshot {
  state: EngineState
  /** The looping cue under the room right now, once it is actually sounding. */
  playing?: CueId
}

/** Long enough to hear as a crossfade, short enough not to smear two phases together. */
const FADE_S = 1.5
/** How far the music dips under a sting. */
const DUCK_TO = 0.35
const DUCK_IN_S = 0.06
const DUCK_OUT_S = 0.5

/** Kept decoded for the whole visit — they are all under two seconds. */
const ONE_SHOTS: readonly CueId[] = ['opener', 'reveal', 'tick']

/** How long a browser gets to allow a new context before the room calls it blocked. */
const SETTLE_MS = 600

/** Events that count as a user gesture for autoplay, in every engine the room supports. */
const GESTURES = ['pointerup', 'touchend', 'keydown'] as const

interface Playing {
  bed: Bed
  gain: GainNode
  sources: AudioBufferSourceNode[]
}

interface Buses {
  music: GainNode
  duck: GainNode
  sfx: GainNode
}

class AudioEngine {
  private ctx: AudioContext | undefined
  private buses: Buses | undefined
  private buffers = new Map<CueId, Promise<AudioBuffer>>()
  private current: Playing | undefined
  /** The bed the room asked for last — which may still be loading. */
  private wanted: Bed | null = null
  private generation = 0
  private musicOn = false
  private sfxOn = false
  private watching = false
  private settled = false
  private listeners = new Set<() => void>()
  private snapshot: EngineSnapshot = { state: 'off' }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getSnapshot = (): EngineSnapshot => this.snapshot

  private emit(): void {
    const state: EngineState = !this.ctx
      ? 'off'
      : this.ctx.state === 'running'
        ? 'running'
        : this.settled
          ? 'suspended'
          : 'starting'
    const playing = this.current?.bed.cue
    if (state === this.snapshot.state && playing === this.snapshot.playing) return
    this.snapshot = { state, playing }
    this.listeners.forEach((fn) => fn())
  }

  /**
   * Call from inside a click or tap handler, synchronously — before any
   * `await`. That is the only moment a browser lets a page start sound, and
   * iOS Safari wants a buffer actually started inside it, so a one-sample
   * silence goes out with the resume.
   */
  unlock(): void {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state !== 'running') void ctx.resume().catch(() => {})
    const blank = ctx.createBufferSource()
    blank.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    blank.connect(ctx.destination)
    blank.start(0)
  }

  /** What the person asked for. Turning music off stops the bed rather than muting it. */
  setEnabled(music: boolean, sfx: boolean): void {
    this.musicOn = music
    this.sfxOn = sfx
    if (!music) this.setBed(null, () => 0)
    if (!music && !sfx) return
    this.ensure()
    if (sfx) ONE_SHOTS.forEach((id) => void this.load(id).catch(() => {}))
  }

  /**
   * Move to a bed, crossfading from whatever is playing.
   *
   * The same music at a new level ramps and keeps its place; different music
   * fades the old one out while the new one fades in. `offset` is read at the
   * moment the new bed actually starts — after its file has loaded — so a slow
   * network still lands on the same bar as everybody else.
   */
  setBed(bed: Bed | null, offset: () => number): void {
    const next = this.musicOn ? bed : null
    const ctx = this.ctx
    const buses = this.buses

    if (sameMusic(this.wanted, next)) {
      this.wanted = next
      if (ctx && this.current && next) this.rampTo(this.current.gain, level(next), ctx)
      return
    }

    this.wanted = next
    const generation = ++this.generation
    this.fadeOut(ctx)
    this.evict(next)
    this.emit()
    if (!next || !ctx || !buses) return

    Promise.all([this.load(next.cue), next.intro ? this.load(next.intro) : undefined])
      .then(([loop, intro]) => {
        if (generation !== this.generation) return
        const bedNow = this.wanted ?? next
        const target = level(bedNow)
        const gain = ctx.createGain()
        gain.connect(buses.music)
        const now = ctx.currentTime
        const sources: AudioBufferSourceNode[] = []
        let loopAt = now

        if (intro && next.intro) {
          // A fanfare that fades in has already lost the point of a fanfare.
          gain.gain.setValueAtTime(target, now)
          const introGain = ctx.createGain()
          introGain.gain.value = target > 0 ? CUES[next.intro].gain / target : 0
          introGain.connect(gain)
          const src = ctx.createBufferSource()
          src.buffer = intro
          src.connect(introGain)
          src.start(now)
          sources.push(src)
          loopAt = now + intro.duration
        } else {
          gain.gain.setValueAtTime(0, now)
          gain.gain.linearRampToValueAtTime(target, now + FADE_S)
        }

        const src = ctx.createBufferSource()
        src.buffer = loop
        src.loop = CUES[next.cue].loop
        src.connect(gain)
        const into = next.intro ? 0 : offset() % loop.duration
        src.start(loopAt, Number.isFinite(into) ? into : 0)
        sources.push(src)

        this.current = { bed: bedNow, gain, sources }
        this.emit()
      })
      .catch(() => {
        // A file that will not load is a quiet room, not a broken one.
      })
  }

  /** A one-shot. Anything but the tick dips the music under it. */
  play(id: CueId): void {
    const ctx = this.ctx
    const buses = this.buses
    if (!this.sfxOn || !ctx || !buses || ctx.state !== 'running') return
    void this.load(id)
      .then((buffer) => {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = CUES[id].gain
        src.connect(gain)
        gain.connect(buses.sfx)
        const now = ctx.currentTime
        src.start(now)
        if (id === 'tick') return
        const duck = buses.duck.gain
        duck.cancelScheduledValues(now)
        duck.setValueAtTime(duck.value, now)
        duck.linearRampToValueAtTime(DUCK_TO, now + DUCK_IN_S)
        duck.setValueAtTime(DUCK_TO, now + buffer.duration)
        duck.linearRampToValueAtTime(1, now + buffer.duration + DUCK_OUT_S)
      })
      .catch(() => {})
  }

  /** Leaving the room. Keeps the context — it is still unlocked — and drops the rest. */
  stop(): void {
    this.setBed(null, () => 0)
  }

  private ensure(): AudioContext | undefined {
    if (this.ctx) return this.ctx
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return undefined

    // Safari only: mix with whatever else is playing and respect the silent
    // switch. A party game has no business overriding somebody's mute.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'ambient'

    const ctx = new AudioContext()
    const music = ctx.createGain()
    const duck = ctx.createGain()
    const sfx = ctx.createGain()
    music.connect(duck)
    duck.connect(ctx.destination)
    sfx.connect(ctx.destination)

    this.ctx = ctx
    this.buses = { music, duck, sfx }
    ctx.addEventListener('statechange', () => this.emit())
    this.watchForGesture()
    setTimeout(() => {
      this.settled = true
      this.emit()
    }, SETTLE_MS)
    this.emit()
    return ctx
  }

  /**
   * After a reload there has been no gesture yet, so the context is born
   * suspended. The next tap anywhere — a vote, a chat key, a headline — is one, so every tap is offered the chance to resume it until one
   * does.
   */
  private watchForGesture(): void {
    if (this.watching) return
    this.watching = true
    const onGesture = () => {
      if (this.ctx?.state === 'running') {
        GESTURES.forEach((type) => window.removeEventListener(type, onGesture, true))
        this.watching = false
        return
      }
      if (this.musicOn || this.sfxOn) this.unlock()
    }
    GESTURES.forEach((type) => window.addEventListener(type, onGesture, true))
  }

  private load(id: CueId): Promise<AudioBuffer> {
    const cached = this.buffers.get(id)
    if (cached) return cached
    const ctx = this.ctx
    if (!ctx) return Promise.reject(new Error('No audio context'))
    const pending = fetch(CUES[id].src)
      .then((res) => {
        if (!res.ok) throw new Error(`${CUES[id].src}: ${res.status}`)
        return res.arrayBuffer()
      })
      .then((data) => ctx.decodeAudioData(data))
    pending.catch(() => this.buffers.delete(id))
    this.buffers.set(id, pending)
    return pending
  }

  private fadeOut(ctx: AudioContext | undefined): void {
    const playing = this.current
    this.current = undefined
    if (!playing || !ctx) return
    const now = ctx.currentTime
    const g = playing.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(0, now + FADE_S)
    playing.sources.forEach((src) => {
      try {
        src.stop(now + FADE_S)
      } catch {
        // Already stopped — an intro that finished on its own.
      }
    })
    setTimeout(() => playing.gain.disconnect(), (FADE_S + 0.1) * 1_000)
  }

  private rampTo(node: GainNode, target: number, ctx: AudioContext): void {
    const now = ctx.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(target, now + FADE_S)
  }

  /** A decoded seventy-second bed is ~25 MB. Keep the one playing, and the stings. */
  private evict(keep: Bed | null): void {
    for (const id of this.buffers.keys()) {
      if (ONE_SHOTS.includes(id) || id === keep?.cue || id === keep?.intro) continue
      this.buffers.delete(id)
    }
  }
}

function level(bed: Bed): number {
  return CUES[bed.cue].gain * bed.level
}

export const audio = new AudioEngine()

/**
 * For the join and start buttons: unlock inside the tap that leaves for the
 * room, so somebody who turned sound on last time hears the lobby without
 * tapping again. Nobody else gets a context — the lobby's offer is a tap of
 * its own, and makes one then.
 */
export function unlockAudio(): void {
  const prefs = readSoundPrefs()
  if (prefs.music || prefs.sfx) audio.unlock()
}
