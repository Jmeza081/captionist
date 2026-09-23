'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether this person wants sound, kept on this browser.
 *
 * **A person's preference, so `localStorage`** — the house rule in
 * `lib/room/identity.ts`: the person is `localStorage`, the seat is
 * `sessionStorage`. Never `GameState`, which would bump `rev` on the number
 * guests drop stale updates against, and would let one player's mute reach
 * everybody else.
 *
 * **Stored, not queried.** There is no `prefers-reduced-sound` media query to
 * mirror the way `useReducedMotion` does, so the only source is what the person
 * told us — and until they have, the answer is silence.
 */

export interface SoundPrefs {
  music: boolean
  sfx: boolean
  /** The lobby has asked once. It never asks again, whatever the answer was. */
  offered: boolean
}

const KEY = 'captionist:sound'

const SILENT: SoundPrefs = { music: false, sfx: false, offered: false }

/**
 * The server's answer, and the first frame's.
 *
 * Silent — the same instinct as "stillness is the safe guess" — and `offered`
 * so the lobby's offer does not flash on the server pass and then vanish for
 * somebody who has already answered it.
 */
const SERVER: SoundPrefs = { music: false, sfx: false, offered: true }

/** Where an answer lives when storage refuses it, for as long as this tab does. */
let memory: SoundPrefs | undefined

function read(): SoundPrefs {
  if (typeof window === 'undefined') return SERVER
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return memory ?? SILENT
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return SILENT
    const p = parsed as Partial<Record<keyof SoundPrefs, unknown>>
    return {
      music: p.music === true,
      sfx: p.sfx === true,
      offered: p.offered === true,
    }
  } catch {
    return memory ?? SILENT
  }
}

const listeners = new Set<() => void>()

/**
 * `getSnapshot` has to return a stable reference between real changes, or
 * React re-enters its render loop — the constraint `useStoredPerson` carries.
 */
let cached: SoundPrefs | undefined

function getSnapshot(): SoundPrefs {
  const next = read()
  if (
    !cached ||
    cached.music !== next.music ||
    cached.sfx !== next.sfx ||
    cached.offered !== next.offered
  ) {
    cached = next
  }
  return cached
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  // Another tab of the same person changing its mind.
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function readSoundPrefs(): SoundPrefs {
  return getSnapshot()
}

/** Merges and stores. A blocked store still updates this tab, for this visit. */
export function setSoundPrefs(patch: Partial<SoundPrefs>): void {
  const next = { ...read(), ...patch }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private window or blocked site data: the answer holds until the tab
    // closes, which is the most anybody could ask of it.
    memory = next
  }
  listeners.forEach((fn) => fn())
}

export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER)
}
