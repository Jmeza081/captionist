import type { ComponentType } from 'react'
import { BriefScreen } from '@/components/organisms/BriefScreen'
import { ComposeScreen } from '@/components/organisms/ComposeScreen'
import { LobbyScreen } from '@/components/organisms/LobbyScreen'
import { PodiumScreen } from '@/components/organisms/PodiumScreen'
import { RevealScreen } from '@/components/organisms/RevealScreen'
import { ScoreScreen } from '@/components/organisms/ScoreScreen'
import { TiebreakScreen } from '@/components/organisms/TiebreakScreen'
import { VoteScreen } from '@/components/organisms/VoteScreen'
import { WaitingScreen } from '@/components/organisms/WaitingScreen'
import type { RoomPhase } from '@/lib/game/types'

/**
 * Which screen renders each phase.
 *
 * A map rather than a switch inside the shell, and declared here rather than
 * inside `RoomShell`, so the shell stays a piece of chrome with no opinion
 * about what it wraps.
 *
 * `opener` is absent because the shell draws its interstitial over the whole
 * screen and renders nothing behind it. Every entry here must be a client
 * component: this module is imported by a server component, and only a client
 * reference survives that boundary — a plain local function would be a server
 * function, which cannot be handed to `RoomShell`.
 *
 * Every phase but `opener` now has a real screen, which is what retired
 * `PhasePending`.
 */
export const SCREENS: Partial<Record<RoomPhase, ComponentType>> = {
  lobby: LobbyScreen,
  brief: BriefScreen,
  compose: ComposeScreen,
  waiting: WaitingScreen,
  vote: VoteScreen,
  tiebreak: TiebreakScreen,
  reveal: RevealScreen,
  score: ScoreScreen,
  podium: PodiumScreen,
}
