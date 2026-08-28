'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

/**
 * Stillness is the safe guess.
 *
 * The server cannot know the preference, and of the two wrong answers "started
 * still, then moved" is the kinder one — the opposite plays an animation at
 * somebody who asked for none.
 */
const getServerSnapshot = () => true

/**
 * Whether this browser has asked for less motion.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: `matchMedia` is an
 * external store, and reading it into state in an effect is the pattern React
 * 19 rightly complains about. This also keeps the server and client passes
 * agreeing on the first render instead of hydrating one thing and painting
 * another.
 *
 * CSS handles this on its own wherever a `@media (prefers-reduced-motion)`
 * block can — this is for the cases where the decision is *which file to
 * fetch*, which no stylesheet can make.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
