'use client'

import { useState } from 'react'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Grid } from '@/components/atoms/Grid'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { TallyPill } from '@/components/atoms/TallyPill'
import { TimerPill } from '@/components/atoms/TimerPill'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import { AppHeader } from '@/components/molecules/AppHeader'
import { AvatarPicker } from '@/components/molecules/AvatarPicker'
import { ChatMessage } from '@/components/molecules/ChatMessage'
import { ChatRail } from '@/components/molecules/ChatRail'
import { CodeEntry } from '@/components/molecules/CodeEntry'
import { Composer } from '@/components/molecules/Composer'
import { GifPanel, type GifResult } from '@/components/molecules/GifPanel'
import { HelpModal } from '@/components/molecules/HelpModal'
import { JoinPanel } from '@/components/molecules/JoinPanel'
import { MediaCard } from '@/components/molecules/MediaCard'
import { ModeCard } from '@/components/molecules/ModeCard'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { Podium } from '@/components/molecules/Podium'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { QuickJoin } from '@/components/molecules/QuickJoin'
import { ReactionFloaters } from '@/components/molecules/ReactionFloaters'
import { ReactionToolbar } from '@/components/molecules/ReactionToolbar'
import { RevealReactionBar } from '@/components/molecules/RevealReactionBar'
import { RoomShare } from '@/components/molecules/RoomShare'
import { RoomToolbox } from '@/components/molecules/RoomToolbox'
import { RoundOpener } from '@/components/molecules/RoundOpener'
import { TunedImage } from '@/components/molecules/TunedImage'
import { UnreadDivider } from '@/components/molecules/UnreadDivider'
import { formatClock } from '@/components/atoms/TimerPill'
import { QUICK_REACTIONS, REACTIONS } from '@/lib/reactions'
import { ROOM_FACE } from '@/lib/room/announce'
import { Case, Section } from './Section'
import { ATTACHMENT, DEAD_CHANNEL, GIFS, MEDIA, PLAYERS } from './placeholders'
import styles from './ComponentGallery.module.scss'

/**
 * The composer's one-tap row, from the room's own list.
 *
 * Hardcoded here once and drifted exactly as predicted — two ids and two labels
 * no longer matched `QUICK_REACTIONS`. The gallery is supposed to show what
 * ships, so it reads the same list every other surface does.
 */
const QUICK = QUICK_REACTIONS.map(({ id, glyph, label }) => ({ id, glyph, label }))

/** Atoms composed into something with a job — and the overlays they open. */
export function MoleculesPanel() {
  const [face, setFace] = useState<string>('ember')
  const [chosen, setChosen] = useState<string[]>(['skull'])
  const [roomCode, setRoomCode] = useState('F34')
  const [quickCode, setQuickCode] = useState('F34')
  const [message, setMessage] = useState('')
  const [gifPanelOpen, setGifPanelOpen] = useState(false)
  const [attached, setAttached] = useState<GifResult | null>(null)
  const [revealChosen, setRevealChosen] = useState<string[]>([])
  const [burst, setBurst] = useState<{ glyph: string; key: number } | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [toolboxOpen, setToolboxOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [toolboxSeconds, setToolboxSeconds] = useState(22)

  function fireBurst(glyph: string) {
    setBurst({ glyph, key: Date.now() })
  }

  return (
    <>
      <Section id="players">
        <Case label="Player rows — roster, tracker, standings">
          <Stack gap={8}>
            <PlayerRow player={PLAYERS.jesse} host />
            <PlayerRow player={PLAYERS.jesska} variant="tracker" status="submitted" done />
            <PlayerRow player={PLAYERS.melania} variant="tracker" status="typing…" />
            <PlayerRow
              player={PLAYERS.lukasz}
              variant="standing"
              rank={1}
              score={18}
              share={0.78}
            />
            <PlayerRow
              player={PLAYERS.jack}
              variant="standing"
              rank={2}
              score={14}
              share={0.6}
            />
          </Stack>
        </Case>
      </Section>

      <Section id="pickers">
        <Case label="Avatar picker — the face you play as">
          <AvatarPicker label="Pick your face" value={face} onChange={setFace} />
        </Case>
        <Case label="Mode cards — a format, not a setting">
          <Inline gap={10} align="start">
            <ModeCard
              title="Caption the image"
              body="One player picks a GIF. Everyone else writes the caption."
              tag="Selected"
              selected
              onSelect={() => {}}
            />
            <ModeCard
              title="React to the caption"
              body="One player writes a prompt. Everyone else answers with a GIF."
              tag="Reversed"
              selected={false}
              onSelect={() => {}}
            />
          </Inline>
        </Case>
      </Section>

      <Section id="media">
        {/* The shape band, first: every card below is drawn at its image's own
            ratio, clamped, and these two are the ends of it. A 16:9 photo used
            to be squared off and show 56% of itself. */}
        <Grid columns={1} mdColumns={3} gap={20}>
          <MediaCard
            src={MEDIA.wide}
            alt="A wide frame"
            width={640}
            height={360}
            caption="16:9 source · drawn 4:3"
          />
          <MediaCard
            src={MEDIA.tall}
            alt="A tall frame"
            width={360}
            height={640}
            caption="9:16 source · drawn 4:5"
          />
          <MediaCard src={MEDIA.retro} alt="A frame with no size" caption="No size · square" />
        </Grid>

        <Grid columns={1} mdColumns={3} gap={20}>
          <MediaCard
            src={MEDIA.serverRack}
            alt="A server rack, on fire"
            topText="Me when I deploy prod"
            caption="Default"
            action={<ReactionCTA />}
          />
          <MediaCard
            src={MEDIA.standup}
            alt="A skull"
            topText="Nuff said"
            rank={1}
            caption="Ranked 1st"
            tallies={<TallyPill glyph="🔥" count={9} label="Fire" />}
          />
          <MediaCard
            src={MEDIA.oncall}
            alt="A flat expression"
            rank={2}
            caption="React mode — no overlay"
          />
          <MediaCard
            src={MEDIA.retro}
            alt="A melting face"
            own
            caption="Your own — locked out"
          />
          <MediaCard
            src={MEDIA.deploy}
            alt="A rocket"
            selected
            caption="Picker selection"
          />
          <MediaCard
            src={MEDIA.outage}
            alt="An upside-down smile"
            winner
            caption="Winner — 4px ring"
          />
        </Grid>
      </Section>

      <Section id="tuned-image">
        <Case label="Tuned in — the static is dropped on load, never merely covered">
          <div className={styles.tunedStage}>
            <TunedImage src={MEDIA.deploy} alt="a rocket" />
          </div>
        </Case>
        <Case label="Never tuned in — a pulled GIF, or a CDN that does not answer">
          <div className={styles.tunedStage}>
            <TunedImage src={DEAD_CHANNEL} alt="a GIF that never arrived" />
          </div>
        </Case>
        <Case label="Nothing coming — a card with no media at all says so in words instead">
          <div className={styles.tunedStage}>
            <TunedImage src={DEAD_CHANNEL} alt="a GIF that never arrived" tuning={false} />
          </div>
        </Case>
        <Case label="A fixed thumb — it shrink-wraps rather than filling, and the set goes with it">
          {/* The other shape this serves: the chat quote's 30px square, the
              composer's 52×40 staged tile, the vote screen's 88px subject. The
              wrapper declares no width, so the size the caller already put on
              its image is the size the set paints in. */}
          <Inline gap={12} align="center">
            <TunedImage className={styles.thumb30} src={DEAD_CHANNEL} alt="" />
            <TunedImage className={styles.thumb52} src={DEAD_CHANNEL} alt="" />
            <TunedImage className={styles.thumb88} src={DEAD_CHANNEL} alt="" />
          </Inline>
        </Case>
      </Section>

      <Section id="prompt">
        <Case label="Compact and hero">
          <Stack gap={12}>
            <PromptBanner prompt="me explaining the outage to leadership" />
            <PromptBanner
              size="lg"
              prompt="me explaining the outage to leadership"
              author={PLAYERS.vic}
            />
          </Stack>
        </Case>
      </Section>

      <Section id="chat">
        <Grid columns={1} mdColumns={2} gap={20}>
          <Case label="Messages">
            <Stack gap={14}>
              {/* `onReact` is what puts the CTA in the row under the bubble, so
                  a reaction lands on this message rather than on whatever
                  arrived last. Every line carries it, because that is the shape
                  the log has — a message with no way to react to it is the odd
                  one out. Inert here, like the bare `ReactionCTA` demo in
                  Atoms. */}
              <ChatMessage
                author={PLAYERS.jack}
                time="2:14"
                body="whoever wrote “QA during prod” I am watching you"
                onReact={() => undefined}
              />
              <ChatMessage
                author={PLAYERS.lukasz}
                time="2:15"
                body="that one is mine and I stand by it"
                onReact={() => undefined}
                tallies={
                  <>
                    <TallyPill glyph="💀" count={5} mine context="chat" label="Skull" />
                    <TallyPill glyph="🔥" count={3} context="chat" label="Fire" />
                  </>
                }
              />
              {/* Drawn with the room's own face rather than a player's, which
                  is what the room does — see `ROOM_FACE`. */}
              <ChatMessage
                author={ROOM_FACE}
                time="2:15"
                body="New mode: React to the caption."
                announcement
              />
              <ChatMessage
                author={PLAYERS.roberto}
                time="2:16"
                body="my exact face during standup"
                onReact={() => undefined}
                attachment={{ src: ATTACHMENT, alt: 'A pair of eyes' }}
              />
              <ChatMessage
                author={PLAYERS.jesska}
                time="2:16"
                body="this is the correct answer and I will hear nothing else"
                onReact={() => undefined}
                replyTo={{ src: ATTACHMENT, caption: 'Nuff said!' }}
              />
              <ChatMessage
                author={PLAYERS.melania}
                time="2:17"
                body=""
                onReact={() => undefined}
                attachment={{ src: ATTACHMENT, alt: 'A pair of eyes' }}
                replyTo={{ caption: 'Day three of the two-hour migration.' }}
              />
              <UnreadDivider count={3} />
            </Stack>
          </Case>
          <Case label="Reaction toolbar — 6 emoji + 4 Slackmojis, then five packs and search across 616">
            <ReactionToolbar
              title="React to this caption"
              reactions={[...REACTIONS]}
              chosen={chosen}
              onPick={(r) =>
                setChosen((prev) =>
                  prev.includes(r.id)
                    ? prev.filter((id) => id !== r.id)
                    : [...prev, r.id],
                )
              }
            />
          </Case>
        </Grid>
      </Section>

      <Section id="chrome">
        <Case label="In-round — phase left, clock right">
          <AppHeader
            phase="Round 2 of 5"
            step="Vote"
            trailing={<TimerPill seconds={31} />}
          />
        </Case>
        <Case label="Lobby — host, and the settings line leads with the mode">
          <AppHeader
            host
            surface="vote"
            settings="React to the caption · 5 rounds · 90s · rank top 3"
          />
        </Case>
      </Section>

      <Section id="entry">
        <Grid columns={1} mdColumns={2} gap={20}>
          <Case label="Typing a code — one input behind the slots">
            <Stack gap={12}>
              <CodeEntry value={roomCode} onChange={setRoomCode} />
              <CodeEntry
                value="ZZZZZZ"
                onChange={() => undefined}
                error="That room code doesn't exist. Check the code and try again."
              />
            </Stack>
          </Case>
          <Case label="Sharing a room — both actions owe a snackbar">
            <RoomShare
              code="C-F34213"
              joinUrl="https://captionist.fun/C-F34213"
              onCopyLink={() => undefined}
              onShareToSlack={() => undefined}
            />
          </Case>
          <Case label="Both ways into a room — the guest's entry panel">
            <JoinPanel code="C-F34213" joinUrl="https://captionist.fun/C-F34213" />
          </Case>
          <Case label="The landing page's one-line join — a different control, on glass">
            <QuickJoin
              value={quickCode}
              onChange={setQuickCode}
              onSubmit={() => undefined}
              actionLabel={quickCode.length === 6 ? 'Join' : `Enter ${6 - quickCode.length} more`}
              blocked={quickCode.length < 6}
            />
          </Case>
        </Grid>
      </Section>

      <Section id="podium">
        <Case label="After round five">
          <Podium
            first={{ player: PLAYERS.lukasz, score: 18 }}
            second={{ player: PLAYERS.jack, score: 14 }}
            third={{ player: PLAYERS.jesska, score: 11 }}
          />
        </Case>
      </Section>

      <Section id="composer">
        <Grid columns={1} mdColumns={2} gap={20}>
          <Case label="Composer — the GIF panel opens above it">
            <Composer
              value={message}
              onChange={setMessage}
              onSend={() => setMessage('')}
              quickReactions={QUICK}
              onQuickReact={(id) => {
                const q = QUICK.find((r) => r.id === id)
                if (q) fireBurst(q.glyph)
              }}
              onReact={() => undefined}
              onAttachGif={() => setGifPanelOpen((v) => !v)}
              attachment={
                attached ? { src: attached.src, alt: attached.alt } : undefined
              }
              onClearAttachment={() => setAttached(null)}
              panel={
                gifPanelOpen ? (
                  <GifPanel
                    results={GIFS}
                    selectedId={attached?.id}
                    onPick={(g) => {
                      setAttached(g)
                      setGifPanelOpen(false)
                    }}
                    onClose={() => setGifPanelOpen(false)}
                  />
                ) : null
              }
            />
          </Case>
          <Case label="GIF panel — picking attaches and closes, never sends">
            <GifPanel
              results={GIFS}
              onPick={() => undefined}
              onClose={() => undefined}
              selectedId="g3"
            />
          </Case>
        </Grid>
      </Section>

      <Section id="reveal">
        <Case label="Tap one — the burst is decorative and never blocks a click">
          <div className={styles.burstStage}>
            <RevealReactionBar
              reactions={QUICK}
              chosen={revealChosen}
              onReact={(id) => {
                const q = QUICK.find((r) => r.id === id)
                if (q) fireBurst(q.glyph)
                setRevealChosen((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id],
                )
              }}
              onOpenToolbar={() => undefined}
            />
            <ReactionFloaters burst={burst} />
          </div>
        </Case>
      </Section>

      <Section id="overlays">
        <Case label="Round opener — auto-dismisses at 3.8s in the game">
          <RoundOpener
            round={2}
            totalRounds={5}
            mode="react"
            headline="Vic writes the prompt."
            subline="Then you answer it with the worst possible GIF."
            roleHolder={PLAYERS.vic}
            onSkip={() => undefined}
          />
        </Case>

        <Case label="Modal, host toolbox and chat rail — open them">
          <Inline gap={10}>
            <Button onClick={() => setModalOpen(true)}>Open the house rules</Button>
            <Button variant="secondary" onClick={() => setToolboxOpen((v) => !v)}>
              {toolboxOpen ? 'Close host toolbox' : 'Open host toolbox'}
            </Button>
            <Button variant="secondary" onClick={() => setChatOpen((v) => !v)}>
              {chatOpen ? 'Collapse chat rail' : 'Expand chat rail'}
            </Button>
          </Inline>
          <p className={styles.clockNote}>
            Toolbox clock reads {formatClock(toolboxSeconds)}.
          </p>
        </Case>

        <Case label="Chat rail — docked beside content, never over it">
          <Box background="lobby" radius="field" className={styles.railDemo}>
            <div className={styles.railContent}>
              <p className={styles.railNote}>
                The rail docks beside the content column. Collapsed, it keeps the
                unread badge and who&rsquo;s here — reacting to the room lives in
                the toolbox now, not on chat&rsquo;s edge.
              </p>
            </div>
            <ChatRail
              open={chatOpen}
              onOpenChange={setChatOpen}
              present={7}
              unread={3}
              players={Object.values(PLAYERS)}
            >
              <Stack gap={12}>
                <ChatMessage
                  author={PLAYERS.jack}
                  time="2:14"
                  body="I am screenshotting this for the retro"
                />
                <ChatMessage
                  author={PLAYERS.jesska}
                  time="2:15"
                  body="bold of you all to peak in round two"
                />
              </Stack>
            </ChatRail>
          </Box>
        </Case>
      </Section>

      {/* Both are `position: fixed`, so they are rendered outside the sections
          that open them and only while this panel is the open tab — a toolbox
          pinned to the corner of the Tokens tab would be furniture from a
          screen that is not on show. */}
      <HelpModal open={modalOpen} onClose={() => setModalOpen(false)} mode="caption" />

      <RoomToolbox
        open={toolboxOpen}
        onOpenChange={setToolboxOpen}
        quickReactions={[...QUICK_REACTIONS]}
        reactions={[...REACTIONS]}
        onReact={fireBurst}
        onHelp={() => setModalOpen(true)}
        host={{
          seconds: toolboxSeconds,
          onSecondsChange: setToolboxSeconds,
          paused: false,
          onTogglePause: () => undefined,
          onSkip: () => undefined,
          onSwitchMode: () => undefined,
          switchModeLabel: 'Switch to prompts',
          onForceTie: () => undefined,
          onJumpToFinal: () => undefined,
          onRestart: () => undefined,
        }}
      />
    </>
  )
}
