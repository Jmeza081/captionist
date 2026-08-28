'use client'

import { useSyncExternalStore } from 'react'

/**
 * The `md` breakpoint, in the one place React has to know about it.
 *
 * Duplicated from `theme/_breakpoints.scss` rather than bridged through a
 * custom property, because a media query is a string a stylesheet cannot hand
 * over — `t.mq('md')` compiles to `@media (min-width: 768px)` and there is
 * nothing to read back out of it. `e2e/tokens.spec.ts` guards the bridge for
 * the values that *can* cross; this one is a comment and a matching number.
 */
const QUERY = '(min-width: 768px)'

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
 * Whether there is room to dock the rail beside the content.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: `matchMedia` is an
 * external store, and reading it into state in an effect is both the pattern
 * React 19 complains about and a guaranteed second render. Same shape as
 * `useReducedMotion`, for the same reasons.
 *
 * **Only for decisions CSS cannot make.** Layout belongs in `t.mq('md')`; this
 * exists for the cases where the answer changes *which markup renders* — the
 * rail is a docked column above `md` and a sheet below it, and "should it start
 * open" has opposite answers for the two.
 */
export function useWideViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
