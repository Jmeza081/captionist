'use client'

import { Button } from '@/components/atoms/Button'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { scoreCopy, standings } from '@/lib/game/selectors'
import { useRoom } from '@/lib/room/useRoom'
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
  if (!state) return null

  const copy = scoreCopy(state)
  const table = standings(state)

  return (
    <Stack gap={34}>
      <div className={styles.head}>
        <Stack gap={10} className={styles.title}>
          <h1 className={styles.headline}>{copy.heading}</h1>
          <p className={styles.body}>{copy.subhead}</p>
        </Stack>

        <Inline gap={14} className={styles.advance}>
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
