import type { ComponentType } from 'react'
import { BriefScreen } from '@/components/organisms/BriefScreen'
import { ComposeScreen } from '@/components/organisms/ComposeScreen'
import { LobbyScreen } from '@/components/organisms/LobbyScreen'
import { PhasePending } from '@/components/organisms/PhasePending'
import type { RoomPhase } from '@/lib/game/types'

/**
 * Which screen renders each phase.
 *
 * A map rather than a switch inside the shell, and declared here rather than
 * inside `RoomShell`, so the shell stays a piece of chrome with no opinion
 * about what it wraps — and so adding phase 3's screens is one line each.
 *
 * `opener` is absent because the shell draws its interstitial over the whole
 * screen and renders nothing behind it. Every entry here must be a client
 * component: this module is imported by a server component, and only a client
 * reference survives that boundary — a plain local function would be a server
 * function, which cannot be handed to `RoomShell`.
 */
export const SCREENS: Partial<Record<RoomPhase, ComponentType>> = {
  lobby: LobbyScreen,
  brief: BriefScreen,
  compose: ComposeScreen,
  waiting: PhasePending,
  vote: PhasePending,
  tiebreak: PhasePending,
  reveal: PhasePending,
  score: PhasePending,
  podium: PhasePending,
}
