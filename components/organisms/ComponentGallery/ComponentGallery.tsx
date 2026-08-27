'use client'

import { useState } from 'react'
import { Avatar, AvatarOverflow, AVATAR_SIZES } from '@/components/atoms/Avatar'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { Chip } from '@/components/atoms/Chip'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Grid } from '@/components/atoms/Grid'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { PresencePill } from '@/components/atoms/PresencePill'
import { ProgressRail } from '@/components/atoms/ProgressRail'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import { RoundProgress } from '@/components/atoms/RoundProgress'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { Snackbar } from '@/components/atoms/Snackbar'
import { Stack } from '@/components/atoms/Stack'
import { Stepper } from '@/components/atoms/Stepper'
import { Tag } from '@/components/atoms/Tag'
import { TallyPill } from '@/components/atoms/TallyPill'
import { TextField } from '@/components/atoms/TextField'
import { TimerPill, formatClock } from '@/components/atoms/TimerPill'
import { Toggle } from '@/components/atoms/Toggle'
import { AppHeader } from '@/components/molecules/AppHeader'
import { ChatMessage } from '@/components/molecules/ChatMessage'
import { ChatRail } from '@/components/molecules/ChatRail'
import { CodeEntry } from '@/components/molecules/CodeEntry'
import { Composer } from '@/components/molecules/Composer'
import { Dropzone } from '@/components/molecules/Dropzone'
import { GifPanel, type GifResult } from '@/components/molecules/GifPanel'
import { HostToolbox } from '@/components/molecules/HostToolbox'
import { JoinPanel } from '@/components/molecules/JoinPanel'
import { QuickJoin } from '@/components/molecules/QuickJoin'
import { MediaCard } from '@/components/molecules/MediaCard'
import { Modal } from '@/components/molecules/Modal'
import { PlayerRow } from '@/components/molecules/PlayerRow'
import { Podium } from '@/components/molecules/Podium'
import { PromptBanner } from '@/components/molecules/PromptBanner'
import { ReactionFloaters } from '@/components/molecules/ReactionFloaters'
import { ReactionToolbar, type Reaction } from '@/components/molecules/ReactionToolbar'
import { RevealReactionBar } from '@/components/molecules/RevealReactionBar'
import { RoomShare } from '@/components/molecules/RoomShare'
import { RoundOpener, type GameMode } from '@/components/molecules/RoundOpener'
import { UnreadDivider } from '@/components/molecules/UnreadDivider'
import { ATTACHMENT, MEDIA, PLAYER_COLORS, SLACKMOJI } from './placeholders'
import styles from './ComponentGallery.module.scss'

const PLAYERS = {
  jesse: { name: 'Jesse', color: PLAYER_COLORS.red },
  jesska: { name: 'Jesska', color: PLAYER_COLORS.turquoise },
  melania: { name: 'Melania', color: PLAYER_COLORS.amber },
  lukasz: { name: 'Lukasz', color: PLAYER_COLORS.olive },
  jack: { name: 'Jack', color: PLAYER_COLORS.purple },
  vic: { name: 'Vic', color: PLAYER_COLORS.yellow },
  roberto: { name: 'Roberto', color: PLAYER_COLORS.green },
}

const REACTIONS: Reaction[] = [
  { id: 'fire', glyph: '🔥', keywords: ['fire', 'hot', 'burn'], label: 'Fire' },
  { id: 'skull', glyph: '💀', keywords: ['skull', 'dead', 'rip'], label: 'Skull' },
  { id: 'cry', glyph: '😂', keywords: ['laugh', 'cry', 'funny'], label: 'Crying laughing' },
  { id: 'eyes', glyph: '👀', keywords: ['eyes', 'look', 'watching'], label: 'Eyes' },
  { id: 'melt', glyph: '🫠', keywords: ['melt', 'melting', 'fine'], label: 'Melting face' },
  { id: 'target', glyph: '🎯', keywords: ['target', 'exact', 'bullseye'], label: 'Direct hit' },
  { id: 'ship', glyph: SLACKMOJI.ship, kind: 'gif', keywords: ['ship', 'deploy'], label: 'Ship it' },
  { id: 'panic', glyph: SLACKMOJI.panic, kind: 'gif', keywords: ['panic', 'outage'], label: 'Panic' },
  { id: 'yikes', glyph: SLACKMOJI.yikes, kind: 'gif', keywords: ['yikes', 'oof'], label: 'Yikes' },
  { id: 'nice', glyph: SLACKMOJI.nice, kind: 'gif', keywords: ['nice', 'good'], label: 'Nice' },
  { id: 'clap', glyph: '👏', keywords: ['clap', 'applause'], label: 'Applause' },
]

const GIFS: GifResult[] = [
  { id: 'g1', src: MEDIA.serverRack, alt: 'a server rack on fire', keywords: ['fire', 'prod', 'outage'] },
  { id: 'g2', src: MEDIA.standup, alt: 'a skull', keywords: ['dead', 'standup', 'rip'] },
  { id: 'g3', src: MEDIA.deploy, alt: 'a rocket', keywords: ['deploy', 'ship', 'friday'] },
  { id: 'g4', src: MEDIA.oncall, alt: 'a flat expression', keywords: ['oncall', 'pager', 'tired'] },
  { id: 'g5', src: MEDIA.retro, alt: 'a melting face', keywords: ['retro', 'fine', 'melt'] },
  { id: 'g6', src: MEDIA.outage, alt: 'an upside-down smile', keywords: ['outage', 'ok', 'sure'] },
]

const QUICK = [
  { id: 'fire', glyph: '🔥', label: 'Fire' },
  { id: 'skull', glyph: '💀', label: 'Skull' },
  { id: 'cry', glyph: '😂', label: 'Crying laughing' },
  { id: 'eyes', glyph: '👀', label: 'Eyes' },
  { id: 'melt', glyph: '🫠', label: 'Melting face' },
  { id: 'target', glyph: '🎯', label: 'Direct hit' },
]

const MODAL_STEPS = [
  {
    eyebrow: 'The setup',
    heading: 'Somebody picks the image',
    body: 'The Captionist searches Giphy or uploads their own. Everyone else waits, briefly.',
    media: { src: MEDIA.deploy, alt: 'A rocket, launching' },
  },
  {
    eyebrow: 'The writing',
    heading: 'Everybody captions it',
    body: 'Top text, bottom text, one clock. Your caption stays anonymous until the reveal.',
    media: { src: MEDIA.serverRack, alt: 'A server rack, on fire' },
  },
  {
    eyebrow: 'The verdict',
    heading: 'The room ranks its top three',
    body: 'You cannot vote for your own. Ties go to sudden death, which is exactly as calm as it sounds.',
    media: { src: MEDIA.standup, alt: 'A skull' },
  },
]

interface SectionProps {
  id: string
  title: string
  spec: string
  children: React.ReactNode
}

function Section({ id, title, spec, children }: SectionProps) {
  return (
    <section className={styles.section} id={id}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.sectionSpec}>{spec}</span>
      </div>
      {children}
    </section>
  )
}

function Case({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.case}>
      <span className={styles.caseLabel}>{label}</span>
      <div className={styles.caseBody}>{children}</div>
    </div>
  )
}

/**
 * Every built component, in its states.
 *
 * This is the review surface: it renders the real components against the real
 * tokens, so a design review looks at the thing itself rather than a mockup of
 * it. It's also what `e2e/components.spec.ts` drives.
 */
export function ComponentGallery() {
  const [mode, setMode] = useState<GameMode>('caption')
  const [source, setSource] = useState<'giphy' | 'upload'>('giphy')
  const [caption, setCaption] = useState('When prod goes down')
  const [search, setSearch] = useState('')
  const [giphySearch, setGiphySearch] = useState(false)
  const [unique, setUnique] = useState(true)
  const [limit, setLimit] = useState(90)
  const [chosen, setChosen] = useState<string[]>(['skull'])
  const [chatOpen, setChatOpen] = useState(true)
  const [toolboxOpen, setToolboxOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [toolboxSeconds, setToolboxSeconds] = useState(22)
  const [message, setMessage] = useState('')
  const [gifPanelOpen, setGifPanelOpen] = useState(false)
  const [attached, setAttached] = useState<GifResult | null>(null)
  const [roomCode, setRoomCode] = useState('F34')
  const [quickCode, setQuickCode] = useState('F34')
  const [revealChosen, setRevealChosen] = useState<string[]>([])
  const [burst, setBurst] = useState<{ glyph: string; key: number } | null>(null)

  function fireBurst(glyph: string) {
    setBurst({ glyph, key: Date.now() })
  }

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <Eyebrow>Captionist · component library</Eyebrow>
        <h1 className={styles.title}>Built components</h1>
        <p className={styles.standfirst}>
          Every component that exists, rendered against the real tokens. Artwork
          is a stand-in — the room uses Giphy GIFs and the design&rsquo;s avatar
          sprites, neither of which is in the repo yet.
        </p>
      </header>

      {/* ---------------- Actions ---------------- */}
      <Section id="buttons" title="Button" spec="5 variants · 3 sizes · blocked">
        <Case label="Variants">
          <Inline gap={10}>
            <Button>Start round</Button>
            <Button variant="secondary">Copy link</Button>
            <Button variant="outline">Change avatar</Button>
            <Button variant="destructive">Restart game</Button>
            <Button variant="ghost">Skip the intro</Button>
          </Inline>
        </Case>
        <Case label="Sizes">
          <Inline gap={10}>
            <Button size="inline">Inline</Button>
            <Button size="form">51px form CTA</Button>
            <Button size="toolbox">Toolbox</Button>
          </Inline>
        </Case>
        <Case label="Blocked — live, focusable, says what's missing">
          <Inline gap={10}>
            <Button blocked>Pick 2 more</Button>
            <Button disabled>Genuinely disabled</Button>
          </Inline>
        </Case>
      </Section>

      <Section id="segmented" title="Segmented control" spec="track · active pill · icons">
        <Case label="Game mode">
          <SegmentedControl
            label="Game mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'caption', label: 'Caption the image' },
              { value: 'react', label: 'React to the caption' },
            ]}
          />
        </Case>
        <Case label="Uploader source — always carries its icons">
          <SegmentedControl
            label="Image source"
            surface="card"
            value={source}
            onChange={setSource}
            options={[
              { value: 'giphy', label: 'Search Giphy', icon: <Icon name="search" size={14} /> },
              { value: 'upload', label: 'Upload your own', icon: <Icon name="uploadTray" size={14} /> },
            ]}
          />
        </Case>
      </Section>

      {/* ---------------- Inputs ---------------- */}
      <Section id="fields" title="Text field" spec="62 / 52 / 46 / 34px">
        <Case label="Caption field — primary, with counter">
          <TextField
            label="Top text"
            size="caption"
            primary
            showCount
            maxLength={60}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </Case>
        <Case label="Search, composer, popover">
          <Stack gap={12}>
            <TextField
              size="search"
              placeholder="Search Giphy"
              icon={<Icon name="search" size={19} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search Giphy"
            />
            <TextField
              size="composer"
              placeholder="Say something regrettable…"
              aria-label="Message"
            />
            <TextField
              size="popover"
              placeholder="Search all emoji"
              icon={<Icon name="search" size={13} />}
              aria-label="Search emoji"
            />
          </Stack>
        </Case>
      </Section>

      <Section id="settings" title="Toggle & stepper" spec="44×24 · 36/88×44">
        <Case label="Room settings">
          <Stack gap={14}>
            <Toggle
              label="Let the picked player search Giphy"
              checked={giphySearch}
              onChange={setGiphySearch}
            />
            <Toggle
              label="Enforce unique nicknames"
              checked={unique}
              onChange={setUnique}
            />
            <Stepper
              label="Submission time limit"
              value={limit}
              step={15}
              min={30}
              max={180}
              format={(v) => `${v} sec`}
              onChange={setLimit}
            />
          </Stack>
        </Case>
      </Section>

      <Section id="dropzone" title="Dropzone" spec="empty · drag-over · file-ready">
        <Grid columns={1} mdColumns={2} gap={20}>
          <Case label="Empty — click or drop">
            <Dropzone onFile={() => undefined} />
          </Case>
          <Case label="File ready">
            <Dropzone
              file={{
                name: 'server-rack.png',
                size: '2.4MB',
                dimensions: '1200×900',
                previewUrl: MEDIA.serverRack,
              }}
              onFile={() => undefined}
            />
          </Case>
        </Grid>
      </Section>

      {/* ---------------- Status ---------------- */}
      <Section id="status" title="Status & labels" spec="timer · tags · chips · tallies">
        <Case label="Timer pill — neutral flips to urgent at 15s">
          <Inline gap={10}>
            <TimerPill seconds={72} />
            <TimerPill seconds={9} />
            <TimerPill seconds={30} suffix="to pick" />
            <TimerPill seconds={120} urgent suffix="sudden death" />
          </Inline>
        </Case>
        <Case label="Progress rail">
          <ProgressRail fraction={0.62} label="Round timer" />
        </Case>
        <Case label="Tags, chips, presence">
          <Inline gap={8}>
            <Tag>Host</Tag>
            <Tag tone="neutral">You</Tag>
            <Tag tone="winner">1st</Tag>
            <Chip selected>deploy on friday</Chip>
            <Chip>merge conflict</Chip>
            <PresencePill count={7} />
          </Inline>
        </Case>
        <Case label="Tally pills — over media, in chat, yours">
          <Inline gap={8}>
            <TallyPill glyph="🔥" count={9} label="Fire" />
            <TallyPill glyph="💀" count={5} mine label="Skull" />
            <TallyPill glyph="😂" count={2} context="chat" label="Crying laughing" />
          </Inline>
        </Case>
        <Case label="Round progress">
          <RoundProgress played={2} total={5} />
        </Case>
        <Case label="Snackbar — confirms an action with no visible result">
          <Stack gap={10} align="start">
            <Snackbar message="Room link copied — captionist.fun/C-F34213" />
            <Snackbar message="Invite posted to #eng-standup" />
          </Stack>
        </Case>
      </Section>

      {/* ---------------- Identity ---------------- */}
      <Section id="identity" title="Avatar & player rows" spec="8 sizes · 3 row variants">
        <Case label="Sizes, selected, dimmed, overflow">
          <Inline gap={10}>
            {AVATAR_SIZES.map((size) => (
              <Avatar key={size} {...PLAYERS.jesse} size={size} />
            ))}
          </Inline>
          <Inline gap={10}>
            <Avatar {...PLAYERS.vic} size={56} selected />
            <Avatar {...PLAYERS.jack} size={56} dimmed />
            <AvatarOverflow count={4} size={56} />
          </Inline>
        </Case>
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

      {/* ---------------- Media ---------------- */}
      <Section id="media" title="Media card" spec="6 states · both modes">
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

      <Section id="prompt" title="Prompt banner" spec="react mode · always full width">
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

      {/* ---------------- Chat & reactions ---------------- */}
      <Section id="chat" title="Chat" spec="message · announcement · unread">
        <Grid columns={1} mdColumns={2} gap={20}>
          <Case label="Messages">
            <Stack gap={14}>
              <ChatMessage
                author={PLAYERS.jack}
                time="2:14"
                body="whoever wrote “QA during prod” I am watching you"
              />
              <ChatMessage
                author={PLAYERS.lukasz}
                time="2:15"
                body="that one is mine and I stand by it"
                tallies={
                  <>
                    <TallyPill glyph="💀" count={5} mine context="chat" label="Skull" />
                    <TallyPill glyph="🔥" count={3} context="chat" label="Fire" />
                  </>
                }
              />
              <ChatMessage
                author={PLAYERS.jesse}
                time="2:15"
                body="30 seconds left on voting. No lobbying."
                announcement
              />
              <ChatMessage
                author={PLAYERS.roberto}
                time="2:16"
                body="my exact face during standup"
                attachment={{ src: ATTACHMENT, alt: 'A pair of eyes' }}
              />
              <UnreadDivider count={3} />
            </Stack>
          </Case>
          <Case label="Reaction toolbar — searchable, 10 defaults">
            <ReactionToolbar
              title="React to this caption"
              reactions={REACTIONS}
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
        <Case label="Reaction CTA — never a bare plus">
          <Inline gap={14}>
            <ReactionCTA />
            <ReactionCTA active />
            <ReactionCTA size="rail" />
          </Inline>
        </Case>
      </Section>

      {/* ---------------- Room chrome ---------------- */}
      <Section id="chrome" title="App header" spec="72px · phase · settings line">
        <Case label="In-round — phase left, clock right">
          <AppHeader
            phase="Round 2 of 5 · Vote"
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

      <Section id="entry" title="Code entry & share" spec="C- prefix · 6 chars">
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

      <Section id="podium" title="Podium" spec="winner centre · 1-2-3 in the DOM">
        <Case label="After round five">
          <Podium
            first={{ player: PLAYERS.lukasz, score: 18 }}
            second={{ player: PLAYERS.jack, score: 14 }}
            third={{ player: PLAYERS.jesska, score: 11 }}
          />
        </Case>
      </Section>

      {/* ---------------- Composer ---------------- */}
      <Section id="composer" title="Composer & GIF panel" spec="send on text or attachment">
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

      <Section id="reveal" title="Reveal reaction bar" spec="5 one-tap · then the toolbar">
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

      {/* ---------------- Overlays ---------------- */}
      <Section id="overlays" title="Overlays" spec="opener · modal · toolbox · rail">
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
        </Case>

        <Case label="Chat rail — docked beside content, never over it">
          <Box background="lobby" radius="field" className={styles.railDemo}>
            <div className={styles.railContent}>
              <p className={styles.railNote}>
                The rail docks beside the content column. Collapsed, it keeps the
                unread badge, the reaction affordance and who&rsquo;s here.
              </p>
            </div>
            <ChatRail
              open={chatOpen}
              onOpenChange={setChatOpen}
              present={7}
              unread={3}
              players={Object.values(PLAYERS)}
              onReact={() => undefined}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        label="How Captionist works"
        steps={MODAL_STEPS}
        stepIndex={step}
        onStepChange={setStep}
      />

      <HostToolbox
        open={toolboxOpen}
        onOpenChange={setToolboxOpen}
        seconds={toolboxSeconds}
        onSecondsChange={setToolboxSeconds}
        paused={false}
        onTogglePause={() => undefined}
        onSkip={() => undefined}
        onSwitchMode={() => undefined}
        switchModeLabel="Switch to prompts"
        onHelp={() => setModalOpen(true)}
        onForceTie={() => undefined}
        onJumpToFinal={() => undefined}
        onRestart={() => undefined}
      />

      <p className={styles.clockNote}>
        Toolbox clock reads {formatClock(toolboxSeconds)}.
      </p>
    </div>
  )
}
