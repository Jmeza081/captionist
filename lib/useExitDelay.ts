'use client'

import { useEffect, useState } from 'react'

/**
 * Keep something mounted for a moment after it is asked to leave.
 *
 * A component that unmounts the instant its flag goes false cannot animate
 * out — there is nothing left on screen to animate. This holds it for the
 * length of its exit and then lets it go.
 *
 * **Not `@starting-style` and `allow-discrete`.** Those are the CSS answer and
 * they are real, but they only work while the element stays in the DOM; the
 * thing standing between the chat sheet and a slide-out was React removing it,
 * which no stylesheet can defer.
 *
 * The state is adjusted **during render** rather than from an effect — React's
 * own "adjusting state when a prop changes" pattern, and the reason the lint
 * rule about setState-in-an-effect is not fought here. Only the timer runs in
 * one, because a timer is exactly the external thing an effect is for.
 */
export function useExitDelay(open: boolean, exitMs: number): boolean {
  const [mounted, setMounted] = useState(open)
  const [wasOpen, setWasOpen] = useState(open)

  // Opening is immediate; only leaving is delayed.
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setMounted(true)
  }

  useEffect(() => {
    if (open || !mounted) return
    const timer = setTimeout(() => setMounted(false), exitMs)
    return () => clearTimeout(timer)
  }, [open, mounted, exitMs])

  return mounted
}
