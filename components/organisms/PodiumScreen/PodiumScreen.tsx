'use client'

import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { ExportKey } from '@/components/molecules/ExportKey'
import { Modal } from '@/components/molecules/Modal'
import { Podium } from '@/components/molecules/Podium'
import { useRoomShell } from '@/components/organisms/RoomShell/context'
import { standingsJob, standingsRow } from '@/lib/export/jobs'
import { useExport } from '@/lib/export/useExport'
import { podiumCopy, podiumPlaces, standings } from '@/lib/game/selectors'
import { useRoom, useRoomCode, useRoomFlags } from '@/lib/room/useRoom'
import styles from './PodiumScreen.module.scss'

/**
 * The end of the game.
 *
 * `state.round` is `null` here — the reducer clears it entering `podium` — so
 * everything on this screen is folded from `history`, which is the only
 * durable record of a score.
 *
 * "Rematch" is `host/restarted`: same roster, cleared history, back to the
 * lobby. It is host-only, so a guest gets the way out and not the way round
 * again. `Back to the start` is a real link, not a button, because it is a
 * navigation — it previews on hover and works before hydration.
 */
export function PodiumScreen() {
  const { state, isHost, send } = useRoom()

  /**
   * The excuse, shown once.
   *
   * Local rather than room state: dismissing it is a per-viewer act, and
   * routing it through the reducer would mean the first player to close it
   * closed it for everyone.
   */
  const [excuseSeen, setExcuseSeen] = useState(false)
  const roomCode = useRoomCode()
  const { notify } = useRoomShell()
  const { exportMedia } = useRoomFlags()
  const exporter = useExport(notify)

  if (!state) return null

  const copy = podiumCopy(state)
  const places = podiumPlaces(state)
  /*
    The design's third pill. It draws "Download the highlight reel" and
    "Post to Slack" here; there is no reel and no storage to keep one in
    (ADR 0014), so the row offers the thing it honestly can — the final table
    as a picture, handed to whatever the device shares with.
  */
  const job = exportMedia ? standingsJob(roomCode, 'Final standings', standings(state).map(standingsRow)) : undefined

  return (
    <Stack gap={34} align="center" className={styles.screen}>
      <Stack gap={12} align="center">
        <Inline gap={8}>
          <Icon name="star" size={22} color="var(--podium-star)" />
          <Eyebrow tone="winner">{copy.eyebrow}</Eyebrow>
        </Inline>
        <h1 className={styles.headline}>{copy.headline}</h1>
        <p className={styles.body}>{copy.body}</p>
      </Stack>

      {places && (
        <Podium first={places.first} second={places.second} third={places.third} />
      )}

      <Inline gap={12} justify="center">
        {/* A room that ended with its host has nobody to restart it, so the
            way on is a new room rather than a command this one would refuse. */}
        {copy.actionHref ? (
          <Button size="form" href={copy.actionHref}>
            {copy.action}
          </Button>
        ) : (
          isHost && (
            <Button size="form" onClick={() => send({ type: 'host/restarted' })}>
              {copy.action}
            </Button>
          )
        )}
        <Button variant="secondary" size="form" href="/">
          {copy.secondary}
        </Button>
        {job && (
          <ExportKey
            size="form"
            label={exporter.labelFor(job)}
            busy={exporter.busy(job.id)}
            progress={exporter.progress(job.id)}
            onClick={() => exporter.run(job)}
          />
        )}
      </Inline>

      {/*
        Why the game stopped short.

        A podium that arrives in round two with no explanation reads as a bug,
        and this one has a cause worth naming: the room ran through the GIF
        provider's hourly allowance. Scores stand — `history` is the durable
        record and the abandoned round never reached it.

        Deliberately does not name the provider. Which one answered is a build
        setting the player never chose, the message is the same either way, and
        a copy string that has to be kept in step with a vendor swap is the
        exact class of drift ADR-0022 removed everywhere else.
      */}
      <Modal
        open={state.endedBecause === 'gifs' && !excuseSeen}
        onClose={() => setExcuseSeen(true)}
        label="Why the game ended"
        tone="error"
        stepIndex={0}
        onStepChange={() => {}}
        steps={[
          {
            eyebrow: 'Out of GIFs',
            heading: 'Nobody paid the GIF bill',
            body: 'We hit the GIF provider’s hourly limit, so that’s the game. Scores stand. Try again at the top of the hour.',
          },
        ]}
      />
    </Stack>
  )
}
