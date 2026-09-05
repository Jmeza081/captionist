'use client'

import { Button } from '@/components/atoms/Button'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { ExportKey } from '@/components/molecules/ExportKey'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { standingsJob, standingsRow } from '@/lib/export/jobs'
import { useExport } from '@/lib/export/useExport'
import { scoreCopy, standings } from '@/lib/game/selectors'
import { useRoom, useRoomCode, useRoomFlags } from '@/lib/room/useRoom'
import styles from './ScoreScreen.module.scss'

/**
 * The scoreboard between rounds.
 *
 * Untimed, like the reveal: the primary action doubles as the round advance,
 * which is why `nextRoundLabel` says "Crown the winner" rather than "Start
 * round 6" on the last one. Host-only, because `round/advanced` is.
 *
 * The round pips belong to the header, not here — `showsRoundProgress` puts
 * them in `AppHeader`'s trailing slot so this screen stays a content column.
 */
export function ScoreScreen() {
  const { state, selfId, isHost, send } = useRoom()
  const roomCode = useRoomCode()
  const { notify } = useRoomShell()
  const { exportMedia } = useRoomFlags()
  const exporter = useExport(notify)
  if (!state) return null

  const copy = scoreCopy(state)
  const table = standings(state)
  const job = exportMedia ? standingsJob(roomCode, 'Standings', table.map(standingsRow)) : undefined

  return (
    <Stack gap={34}>
      <div className={styles.head}>
        <Stack gap={10} className={styles.title}>
          <h1 className={styles.headline}>{copy.heading}</h1>
          <p className={styles.body}>{copy.subhead}</p>
        </Stack>

        <Inline gap={14} className={styles.advance}>
          {/* Before the host's primary, and alone in the row for a guest: it
              changes nothing in the room, so it does not get the last word. */}
          {job && (
            <ExportKey
              label={exporter.labelFor(job)}
              busy={exporter.busy(job.id)}
              progress={exporter.progress(job.id)}
              onClick={() => exporter.run(job)}
            />
          )}
          {copy.nextRoleLine && <span className={styles.next}>{copy.nextRoleLine}</span>}
          {isHost && (
            <Button size="form" onClick={() => send({ type: 'round/advanced' })}>
              {copy.action}
            </Button>
          )}
        </Inline>
      </div>

      <Stack gap={10} as="ol" className={styles.table}>
        {table.map((row) => (
          <PlayerRow
            key={row.id}
            player={row.player}
            variant="standing"
            rank={row.rank}
            score={row.score}
            share={row.share}
            note={row.note}
            host={row.id === state.hostId}
            you={row.id === selfId}
          />
        ))}
      </Stack>
    </Stack>
  )
}
