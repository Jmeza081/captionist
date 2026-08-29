import type { BootProgress } from '@/lib/room/store'

/**
 * What each role's three rows say.
 *
 * **Every one of these is a milestone that actually resolves.** The mockups
 * this screen comes from drew two rows the app has no work behind — the room
 * code is `generateCode(Date.now())` and nothing reserves it, and no GIF deck
 * is loaded at boot — so the copy was moved onto the real sequence rather than
 * the work being faked to match the copy. See `docs/roadmap.md`.
 */
export const BOOT_STEPS: Record<BootProgress['role'], readonly string[]> = {
  // The seat probe and the presence election, which is the thing that actually
  // answers "is anybody hosting this code".
  guest: ['Finding the room', 'Waiting for the host', 'Seating you in the lobby'],
  // The same election, seen from the side that wins it.
  host: ['Claiming your room code', 'Setting your rules', 'Opening the waiting room'],
}

/** The label on the code pill. A guest is given a room; a host is given a code. */
export const CODE_LABEL: Record<BootProgress['role'], string> = {
  guest: 'Room',
  host: 'Your code',
}

export const BOOT_TITLE: Record<BootProgress['role'], string> = {
  guest: 'Joining the room',
  host: 'Opening your room',
}

/**
 * The line under the card.
 *
 * The host's replaces the mockup's "Your room stays open for 30 minutes" —
 * nothing implements a room timeout, so it was a promise the app could break.
 * What is true is that joining is legal in any phase (`lib/game/actions.ts`),
 * which is the more useful half of that sentence anyway.
 */
export const BOOT_FOOTNOTE: Record<BootProgress['role'], string> = {
  guest:
    'Hang tight — the host decides when the first round starts, so you may land in the waiting room for a moment.',
  host: 'Share the code or the link. Players can drop in at any point between rounds.',
}
