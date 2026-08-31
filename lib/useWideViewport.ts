'use client'

import { useSyncExternalStore } from 'react'

/**
 * The `lg` breakpoint, in the one place React has to know about it.
 *
 * **`lg`, not `md`, because docking is not the same question as arriving
 * open.** The rail *can* dock from `md` — its stylesheet still switches there —
 * but a 360px rail docked into a 768px window leaves the room 288px, which is
 * less than the game needs and less than any of its screens will now lay out
 * in. So between `md` and `lg` the rail docks collapsed: chat is one key away,
 * and the round has the column. Above `lg` there is room for both and it
 * greets you open, which is what the design draws.
 *
 * Duplicated from `theme/_breakpoints.scss` rather than bridged through a
 * custom property, because a media query is a string a stylesheet cannot hand
 * over — `t.mq('lg')` compiles to `@media (min-width: 1024px)` and there is
 * nothing to read back out of it. `e2e/tokens.spec.ts` guards the bridge for
 * the values that *can* cross; this one is a comment and a matching number.
 */
const QUERY = '(min-width: 1024px)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

/**
 * A phone is the safe guess.
 *
 * The server has no viewport, and this drives whether the chat rail arrives
 * open — so of the two wrong first answers, "docked closed, then opened" costs
 * a rail's width of reflow, while the opposite would flash a full-screen sheet
 * over the room on a phone before taking it away again.
 */
const getServerSnapshot = () => false

/**
 * Whether there is room for the room *and* the rail at once.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: `matchMedia` is an
 * external store, and reading it into state in an effect is both the pattern
 * React 19 complains about and a guaranteed second render. Same shape as
 * `useReducedMotion`, for the same reasons.
 *
 * **Only for decisions CSS cannot make.** Layout belongs in `t.mq()` and, for
 * anything inside the content column, in a `@container` query; this exists for
 * the cases where the answer changes *which markup renders* — "should the rail
 * start open" is a state React holds, not a rule a stylesheet can express.
 */
export function useWideViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
