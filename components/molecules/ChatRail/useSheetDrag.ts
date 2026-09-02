'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/**
 * The sheet's two resting heights, as a fraction of the viewport.
 *
 * `tall` is the height the sheet has always opened at. `short` is new, and is
 * the reason the handle is worth dragging at all: a phone playing a round
 * cannot read the board through 78% of chat, and the alternative was closing
 * chat, looking, and opening it again.
 *
 * Never full height — the header carries the phase and the clock, and a sheet
 * over the countdown would make chat cost you the round.
 */
export const DETENTS = { tall: 0.78, short: 0.42 } as const
export type Detent = keyof typeof DETENTS

/** Past this much of the sheet's own height, the release lands on the next detent. */
const TRAVEL_RATIO = 0.28

/** A flick beats the distance: px per ms, either way. */
const FLICK_VELOCITY = 0.5

/**
 * Past this much movement, the press was a drag and not a tap.
 *
 * A pointerdown and pointerup on the same button fire a `click` afterwards
 * however far the pointer travelled in between — so without this, every drag
 * settled onto a detent and then had the click immediately toggle it back off
 * again. Two gestures, one of them invisible, fighting over the same state.
 */
const TAP_SLOP = 6

export interface SheetDrag {
  /** The resting height. Only meaningful below `md`; the docked rail ignores it. */
  detent: Detent
  /** Live finger offset in px, positive downward. Zero unless a drag is in flight. */
  offset: number
  dragging: boolean
  /** Spread onto the handle. */
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  }
  /** Click and Enter both land here: toggle between the two heights. */
  toggle: () => void
}

/**
 * Drag the sheet's handle to resize it, or past the bottom to dismiss it.
 *
 * A hook rather than logic inside `ChatRail` for one reason: the rail is one
 * component at both sizes, and this is the half of it that only exists at one.
 * Keeping it here means the docked rail imports a function it never calls
 * rather than carrying a pile of pointer state it never uses.
 *
 * **The handle is a real control, not a decoration with a listener.** It was
 * an `aria-hidden` span, which is the right call for a bar that does nothing;
 * a bar that resizes the sheet has to be reachable without a pointer, so it is
 * a button, it toggles on Enter, and the arrow keys move it a detent at a time.
 * Dragging is the shortcut, never the only way.
 */
export function useSheetDrag(onDismiss: () => void): SheetDrag {
  const [detent, setDetent] = useState<Detent>('tall')
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  /**
   * The press this drag started from — where and when.
   *
   * A ref rather than state: it is read inside the move handler and writing it
   * would re-render on every frame of a drag that already re-renders for the
   * offset alone.
   */
  const press = useRef<{ y: number; at: number; lastY: number; lastAt: number } | null>(null)
  /** Set by a drag, read and cleared by the `click` that follows it. */
  const wasDrag = useRef(false)

  const height = useCallback(
    (which: Detent) =>
      // `visualViewport` is what the sheet is actually sized against once a
      // keyboard is up; `innerHeight` is the fallback for the first frame.
      DETENTS[which] * (window.visualViewport?.height ?? window.innerHeight),
    [],
  )

  const settle = useCallback(
    (dy: number, velocity: number) => {
      const travel = height(detent) * TRAVEL_RATIO
      const down = dy > travel || velocity > FLICK_VELOCITY
      const up = dy < -travel || velocity < -FLICK_VELOCITY

      if (down) {
        // One step down per drag, and the step below `short` is gone. Two
        // detents means the shrink and the dismissal are the same gesture
        // twice rather than a threshold you have to find inside one.
        if (detent === 'tall') setDetent('short')
        else onDismiss()
      } else if (up) {
        setDetent('tall')
      }
    },
    [detent, height, onDismiss],
  )

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    // Mouse only on the primary button; a right-click on the handle is not a drag.
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { y: event.clientY, at: event.timeStamp, lastY: event.clientY, lastAt: event.timeStamp }
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const start = press.current
    if (!start) return
    start.lastY = event.clientY
    start.lastAt = event.timeStamp
    setOffset(event.clientY - start.y)
  }, [])

  const end = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const start = press.current
      press.current = null
      setDragging(false)
      setOffset(0)
      if (!start) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      const dy = event.clientY - start.y
      wasDrag.current = Math.abs(dy) > TAP_SLOP
      // Over the last leg of the drag rather than the whole of it, so a slow
      // reposition that ends in a flick still reads as a flick.
      const elapsed = Math.max(event.timeStamp - start.lastAt, 1)
      settle(dy, (event.clientY - start.lastY) / elapsed)
    },
    [settle],
  )

  const cancel = useCallback(() => {
    press.current = null
    setDragging(false)
    setOffset(0)
  }, [])

  const toggle = useCallback(() => {
    // The click that trails every drag. The drag already decided where the
    // sheet lands; this would undo it a frame later.
    if (wasDrag.current) {
      wasDrag.current = false
      return
    }
    setDetent((current) => (current === 'tall' ? 'short' : 'tall'))
  }, [])

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setDetent('tall')
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setDetent('short')
    }
  }, [])

  /**
   * **The height you chose sticks for the session.**
   *
   * The rail stays mounted while it is shut — the collapsed strip is the same
   * component — so the detent survives closing and reopening, whichever way it
   * was closed. One rule rather than two: "the close key remembers and the
   * drag forgets" is a distinction nobody would predict, and a sheet that
   * reopens at the size you last asked for is the size you last asked for.
   *
   * A drag still in flight when the rail unmounts — the room left, the tab
   * closed — is abandoned here, or a `dragging` left set would paint the next
   * mount with its transition off.
   */
  useEffect(() => cancel, [cancel])

  return {
    detent,
    offset,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: cancel,
      onKeyDown,
    },
    toggle,
  }
}
