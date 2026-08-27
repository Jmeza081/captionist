'use client'

import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Stack } from '@/components/atoms/Stack'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { nextRoundLabel, standings, submissionRows } from '@/lib/game/selectors'
import type { RoomPhase } from '@/lib/game/types'
import { useRoom } from '@/lib/room/useRoom'
import styles from './PhasePending.module.scss'

/**
 * The phases that have no screen yet.
 *
 * Deliberately not a spinner. It renders the two things every phase-3 screen
 * will need anyway — the right roster, and the host's advance control — so a
 * complete game is playable now and phase 3 deletes copy rather than structure.
 *
 * `reveal` and `score` are untimed by design: without the button here, a room
 * with no bots in it stops permanently.
 */

/** Temporary: phase 3 replaces each of these with a real screen. */
const PENDING_NAMES: Partial<Record<RoomPhase, string>> = {
  waiting: 'Waiting',
  vote: 'Vote',
  tiebreak: 'Sudden death',
  reveal: 'Reveal',
  score: 'Scoreboard',
  podium: 'Podium',
}

/** Which roster reads honestly at each phase. */
const TRACKER_PHASES: readonly RoomPhase[] = ['waiting']

export function PhasePending() {
  const { state, selfId, isHost, send } = useRoom()
  if (!state) return null

  const name = PENDING_NAMES[state.phase] ?? state.phase
  const tracker = TRACKER_PHASES.includes(state.phase)
  const rows = tracker ? submissionRows(state) : []
  const table = tracker ? [] : standings(state)
  const canAdvance = isHost && (state.phase === 'reveal' || state.phase === 'score')

  return (
    <Stack gap={26} padding={20} className={styles.pending}>
      <Stack gap={8}>
        <Eyebrow>{name}</Eyebrow>
        <h1 className={styles.headline}>This screen lands next.</h1>
        <p className={styles.body}>
          The room is really here — the scores below are live. Only the layout is
          missing.
        </p>
      </Stack>

      <Box background="card" radius="card" padding={20}>
        <Stack gap={10}>
          {tracker
            ? rows.map((row) => (
                <PlayerRow
                  key={row.player.name}
                  player={row.player}
                  variant="tracker"
                  status={row.status}
                  done={row.done}
                />
              ))
            : table.map((row) => (
                <PlayerRow
                  key={row.id}
                  player={row.player}
                  variant="standing"
                  rank={row.rank}
                  score={row.score}
                  share={row.share}
                  host={row.id === selfId}
                />
              ))}
        </Stack>
      </Box>

      {canAdvance && (
        <Button size="form" fullWidth onClick={() => send({ type: 'round/advanced' })}>
          {nextRoundLabel(state)}
        </Button>
      )}
    </Stack>
  )
}
