'use client'

import { Box } from '@/components/atoms/Box'
import { Stack } from '@/components/atoms/Stack'
import { RoomBootScreen } from '@/components/organisms/RoomBootScreen'
import { Case, Section } from './Section'
import { PLAYERS } from './placeholders'
import styles from './ComponentGallery.module.scss'

/**
 * The screens, and the one that can be shown out of a room.
 *
 * A tier where "render it here" mostly does not apply: an organism reads
 * `useRoom()`, so it needs a room around it, and a room in a gallery case is
 * a second engine ticking a second clock behind whatever tab you left open.
 * The dev harness is where they are reviewed — `?phase=` boots a fixture
 * straight into one — so this tab links there rather than faking it.
 *
 * `RoomBootScreen` is the exception and says why in its own inventory row: it
 * takes props and reads nothing, which is what lets its three states sit in a
 * case like a molecule's.
 */

/** Every phase the harness can boot, in the order a game meets them. */
const PHASES: ReadonlyArray<{ phase: string; screen: string; note: string }> = [
  { phase: 'lobby', screen: 'LobbyScreen', note: 'The room before it starts' },
  { phase: 'brief', screen: 'BriefScreen', note: 'Picking the GIF, or writing the prompt' },
  { phase: 'compose', screen: 'ComposeScreen', note: 'Captioning it, or answering it' },
  { phase: 'waiting', screen: 'WaitingScreen', note: 'Your entry is in, the room’s is not' },
  { phase: 'vote', screen: 'VoteScreen', note: 'Ranking the room’s entries' },
  { phase: 'tiebreak', screen: 'TiebreakScreen', note: 'Sudden death, and the only screen that names people' },
  { phase: 'reveal', screen: 'RevealScreen', note: 'Where anonymity ends' },
  { phase: 'score', screen: 'ScoreScreen', note: 'Standings between rounds' },
  { phase: 'podium', screen: 'PodiumScreen', note: 'The champion, and the two ways on' },
]

export function OrganismsPanel() {
  return (
    <>
      <Section id="boot">
        <Case label="Guest — the seat has been asked for, not yet given">
          <div className={styles.bootDemo}>
            <RoomBootScreen
              variant="guest"
              code="C-F34213"
              states={['done', 'done', 'active']}
              fraction={5 / 6}
              player={PLAYERS.vic}
              cancelHref="/join/C-F34213"
            />
          </div>
        </Case>

        <Case label="Host — the room is being built around the code they picked">
          <div className={styles.bootDemo}>
            <RoomBootScreen
              variant="host"
              code="C-F34213"
              states={['done', 'active', 'pending']}
              fraction={0.5}
              cancelHref="/host"
            />
          </div>
        </Case>

        <Case label="Refused — a full room, said on the screen that is showing">
          <div className={styles.bootDemo}>
            <RoomBootScreen
              variant="guest"
              code="C-F34213"
              states={['done', 'done', 'failed']}
              fraction={2 / 3}
              player={PLAYERS.vic}
              cancelHref="/join/C-F34213"
              failure="This room is full — 20 players is the limit."
            />
          </div>
        </Case>
      </Section>

      <Section id="screens">
        <Case label="Each phase, seeded — opens a real room in a new tab">
          <Box background="card" radius="card" padding={20}>
            <Stack gap={12}>
              <p className={styles.note}>
                Every screen below reads <code className={styles.code}>useRoom()</code>,
                so it needs a room rather than a case. The harness gives it one:
                <code className={styles.code}>?phase=</code> boots a seeded fixture
                straight into that screen, <code className={styles.code}>&amp;bots=4</code>
                {' '}fills the seats, and <code className={styles.code}>&amp;as=p2</code>{' '}
                sits you in somebody else&rsquo;s chair — which is the only way to see
                the faces a role holder never gets.
              </p>
              <ul className={styles.screenList}>
                {PHASES.map(({ phase, screen, note }) => (
                  <li key={phase} className={styles.screenRow}>
                    <a
                      className={styles.screenLink}
                      href={`/room/DEV?seed=42&phase=${phase}&bots=4&gifs=stub`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {screen}
                    </a>
                    <span className={styles.screenNote}>{note}</span>
                    <code className={styles.code}>?phase={phase}</code>
                  </li>
                ))}
              </ul>
            </Stack>
          </Box>
        </Case>

        <Case label="Not here, and not by omission">
          <Box background="card" radius="card" padding={20}>
            <p className={styles.note}>
              <strong className={styles.strong}>RoomShell</strong> is the chrome those
              screens render inside, so it is on every link above.{' '}
              <strong className={styles.strong}>ChatPanel</strong> rides in its rail.{' '}
              <strong className={styles.strong}>ReconnectOverlay</strong> is{' '}
              <code className={styles.code}>position: fixed</code> with no dismiss — in a
              gallery it would cover the page, so{' '}
              <code className={styles.code}>e2e/reconnect.spec.ts</code> drives it against
              a real room instead. <strong className={styles.strong}>RoundPicker</strong>{' '}
              needs a live GIF search and the shell&rsquo;s snackbar; it is the board on{' '}
              <code className={styles.code}>?phase=brief</code>.
            </p>
          </Box>
        </Case>
      </Section>
    </>
  )
}
