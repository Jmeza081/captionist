'use client'

import { useState } from 'react'
import { Avatar, AvatarOverflow, AVATAR_SIZES } from '@/components/atoms/Avatar'
import { Button } from '@/components/atoms/Button'
import { Chip } from '@/components/atoms/Chip'
import { Icon } from '@/components/atoms/Icon'
import { Inline } from '@/components/atoms/Inline'
import { PresencePill } from '@/components/atoms/PresencePill'
import { ProgressRail } from '@/components/atoms/ProgressRail'
import { RankSlot } from '@/components/atoms/RankSlot'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import { RoundProgress } from '@/components/atoms/RoundProgress'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { CloseButton } from '@/components/atoms/CloseButton'
import { Snackbar } from '@/components/atoms/Snackbar'
import { Stack } from '@/components/atoms/Stack'
import { StatusPill } from '@/components/atoms/StatusPill'
import { Stepper } from '@/components/atoms/Stepper'
import { Tag } from '@/components/atoms/Tag'
import { TallyPill } from '@/components/atoms/TallyPill'
import { TextField } from '@/components/atoms/TextField'
import { TimerPill } from '@/components/atoms/TimerPill'
import { Toggle } from '@/components/atoms/Toggle'
import { TvStatic } from '@/components/atoms/TvStatic'
import { WaitingDots } from '@/components/atoms/WaitingDots'
import type { GameMode } from '@/components/molecules/RoundOpener'
import { Case, Section } from './Section'
import { PLAYERS } from './placeholders'
import styles from './ComponentGallery.module.scss'

/**
 * The tier with no dependencies.
 *
 * Its own state, rather than the shell's: a panel that is not the open tab is
 * unmounted, so what a control was set to is that panel's business and nobody
 * else's.
 */
export function AtomsPanel() {
  const [mode, setMode] = useState<GameMode>('caption')
  const [caption, setCaption] = useState('When prod goes down')
  const [search, setSearch] = useState('')
  const [gifSearch, setGifSearch] = useState(false)
  const [unique, setUnique] = useState(true)
  const [limit, setLimit] = useState(90)

  return (
    <>
      <Section id="buttons">
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

      <Section id="segmented">
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
      </Section>

      <Section id="fields">
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
              placeholder="Search GIFs"
              icon={<Icon name="search" size={19} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search GIFs"
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

      <Section id="settings">
        <Case label="Room settings">
          <Stack gap={14}>
            <Toggle
              label="Let the picked player search GIFs"
              checked={gifSearch}
              onChange={setGifSearch}
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

      <Section id="status">
        <Case label="Timer pill — neutral flips to urgent at 15s">
          <Inline gap={10}>
            <TimerPill seconds={72} />
            <TimerPill seconds={9} />
            <TimerPill seconds={30} suffix="to pick" />
            <TimerPill seconds={120} urgent suffix="sudden death" />
          </Inline>
        </Case>
        <Case label="Progress rail — the header hairline, and the countdown bar">
          <Stack gap={12}>
            <ProgressRail fraction={0.62} label="Round timer" />
            <ProgressRail fraction={0.62} urgent size="bar" label="Seat held" />
          </Stack>
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
        <Case label="Status pills — over media, and on the canvas">
          <Inline gap={8}>
            <StatusPill context="media" confirmed>
              Locked in
            </StatusPill>
            <StatusPill note="Jesska and Melania can’t vote in their own duel">
              4 of 7 have voted
            </StatusPill>
          </Inline>
        </Case>
        <Case label="Waiting dots — the room is doing something, and it is not yours to do">
          <WaitingDots label="Waiting for the host" />
        </Case>
        <Case label="Rank slots — filled, and waiting">
          <Inline gap={8}>
            <RankSlot ordinal="1st" entry="It compiles. Ship it." first />
            <RankSlot ordinal="2nd" entry="The rollback also failed." />
            <RankSlot ordinal="3rd" />
          </Inline>
        </Case>
        <Case label="Round progress">
          <RoundProgress played={2} total={5} />
        </Case>
        {/* An atom that reads as chat furniture, and is shown here rather than
            in the chat section for the reason the tabs exist: it imports
            nothing but `Icon`, so it is an atom wherever it ends up drawn. */}
        <Case label="Reaction CTA — never a bare plus">
          <Inline gap={14}>
            <ReactionCTA />
            <ReactionCTA active />
            <ReactionCTA size="rail" />
          </Inline>
        </Case>
        {/* Shown at both sizes side by side, because the whole decision this
            atom records is that a header's key and a staged row's key are the
            same control at two scales rather than two controls. */}
        <Case label="Close key — a plate, not a bare mark">
          <Inline gap={14} align="center">
            <CloseButton label="Close the demo" onClick={() => undefined} />
            <CloseButton label="Clear the demo" size="small" onClick={() => undefined} />
          </Inline>
        </Case>
        <Case label="Snackbar — confirms an action with no visible result">
          <Stack gap={10} align="start">
            <Snackbar message="Room link copied — captionist.fun/C-F34213" />
            <Snackbar message="Invite posted to #eng-standup" />
          </Stack>
        </Case>
      </Section>

      <Section id="avatars">
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
        <Case label="Hats — worn from 34px up, and the crown nobody picks">
          {/* The floor, shown rather than described: the first two go bare. */}
          <Inline gap={10} data-testid="avatar-sizes">
            {AVATAR_SIZES.map((size) => (
              <Avatar key={size} {...PLAYERS.jesse} hat="party" size={size} />
            ))}
          </Inline>
          <Inline gap={10}>
            <Avatar {...PLAYERS.vic} hat="viking" size={56} />
            <Avatar {...PLAYERS.jack} hat="sombrero" size={56} />
            <Avatar {...PLAYERS.jesse} hat="crown" size={56} selected />
          </Inline>
        </Case>
      </Section>

      <Section id="tv-static">
        <Case label="One set — a channel that has not tuned in">
          <div className={styles.staticStage}>
            <TvStatic />
          </div>
        </Case>
        <Case label="Held still — the wall's pause control, and reduced motion">
          <div className={styles.staticStage}>
            <TvStatic paused />
          </div>
        </Case>
        <Case label="Seeded — each set is its own television, not one field behind a grille">
          <div className={styles.staticWall}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={styles.staticStage}>
                <TvStatic seed={i} />
              </div>
            ))}
          </div>
        </Case>
      </Section>
    </>
  )
}
