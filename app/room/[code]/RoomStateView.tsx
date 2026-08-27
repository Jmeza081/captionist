'use client'

import { Stack } from '@/components/atoms/Stack'
import { phaseLabel, settingsLine, standings } from '@/lib/game/selectors'
import { useRoom } from '@/lib/room/useRoom'
import styles from './RoomStateView.module.scss'

/**
 * The phase-1 milestone, rendered.
 *
 * No game UI — that is phase 2. This exists to prove the claim the spine was
 * built to earn: a full room, driven only by intents over a transport, walks
 * every phase to the podium. If this route runs, the screens have real state to
 * be assembled against.
 */
export function RoomStateView() {
  const { state, status, selfId } = useRoom()

  if (!state) {
    return (
      <Stack gap={8} padding={20}>
        <p className={styles.meta}>Transport {status} — waiting for the first broadcast.</p>
      </Stack>
    )
  }

  const table = standings(state)

  return (
    <Stack gap={14} padding={20}>
      <h1 className={styles.headline}>
        {state.roomCode} — {phaseLabel(state) ?? state.phase}
      </h1>
      <p className={styles.meta}>
        Round {state.roundNumber} of {state.settings.totalRounds} · {settingsLine(state)} ·{' '}
        {state.players.length} players · rev {state.rev} · you are {selfId}
      </p>
      <p className={styles.meta} data-testid="room-phase">
        {state.phase}
      </p>
      <pre className={styles.dump} data-testid="room-standings">
        {table.map((row) => `${row.rank}. ${row.player.name}: ${row.score}`).join('\n') ||
          'no scores yet'}
      </pre>
      <pre className={styles.dump} data-testid="room-state">
        {JSON.stringify(state, null, 2)}
      </pre>
    </Stack>
  )
}
