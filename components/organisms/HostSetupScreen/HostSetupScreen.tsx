'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Box } from '@/components/atoms/Box'
import { Icon } from '@/components/atoms/Icon'
import { Button } from '@/components/atoms/Button'
import { Inline } from '@/components/atoms/Inline'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { Stack } from '@/components/atoms/Stack'
import { Stepper } from '@/components/atoms/Stepper'
import { TextField } from '@/components/atoms/TextField'
import { Toggle } from '@/components/atoms/Toggle'
import { AvatarPicker } from '@/components/molecules/AvatarPicker'
import { HatPicker } from '@/components/molecules/HatPicker'
import { HelpModal } from '@/components/molecules/HelpModal'
import { HeroWall } from '@/components/molecules/HeroWall'
import { ModeCard } from '@/components/molecules/ModeCard'
import { generateCode } from '@/lib/game/codes'
import {
  CAP_SECONDS_MAX,
  CAP_SECONDS_MIN,
  CAP_SECONDS_STEP,
  DEFAULT_SETTINGS,
  ROUNDS_MAX,
  ROUNDS_MIN,
} from '@/lib/game/constants'
import { hostSetupCopy, modeChoices, showsCaptionFormat } from '@/lib/game/selectors'
import type { HatId } from '@/lib/game/types'
import type { GameMode, RoomSettings } from '@/lib/game/types'
import type { WallTile } from '@/lib/gifs/wall'
import { writeIdentity } from '@/lib/room/identity'
import { writePendingSettings } from '@/lib/room/pendingSettings'
import { useStoredPerson } from '@/lib/room/useStoredPerson'
import { useSuggestedName } from '@/lib/room/useSuggestedName'
import styles from './HostSetupScreen.module.scss'

/**
 * The only screen where the room's rules are decided.
 *
 * An organism because it routes, and like `JoinScreen` it calls no `useRoom()`
 * — the room does not exist until "Open the room" pushes to `/room/[code]`,
 * where this tab claims the code and builds it.
 *
 * **The defaults are playable as-is.** That is the design's own note, and it is
 * why every control starts from `DEFAULT_SETTINGS` and nothing here is
 * required: a host who reads none of it still gets a working game.
 *
 * **Two columns from `xl`, one below it.** The form holds its 600px either
 * way; what changes is what is beside it. A wall of the app's own GIFs is the
 * only thing on this screen that says what the room is for — the rest is
 * toggles — so it gets the 60%, and below `xl` there is no room for it and it
 * is not rendered at all rather than stacked under a form nobody scrolled to.
 */

export interface HostSetupScreenProps {
  /** The wall beside the form, resolved on the server. See `app/host/page.tsx`. */
  tiles: readonly WallTile[]
}

export function HostSetupScreen({ tiles }: HostSetupScreenProps) {
  const router = useRouter()
  const copy = hostSetupCopy()

  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS)
  const [helpOpen, setHelpOpen] = useState(false)

  // See `JoinScreen`: the face is remembered, the nickname is suggested fresh
  // per tab, and anything typed sits on top of both.
  const stored = useStoredPerson()
  const suggested = useSuggestedName()
  const [typedName, setTypedName] = useState<string | undefined>(undefined)
  const [pickedSeed, setPickedSeed] = useState<string | undefined>(undefined)
  const name = typedName ?? suggested
  const seed = pickedSeed ?? stored.avatarSeed
  /**
   * The hat, and a sentinel that is not `undefined`.
   *
   * `undefined` already means "bare-headed", so it cannot also mean "hasn't
   * touched the picker" — `pickedHat ?? stored.hat` would make "No hat"
   * unclickable, falling straight back to the stored one. The wrapper object
   * is what tells the two apart.
   */
  const [pickedHat, setPickedHat] = useState<{ hat?: HatId } | undefined>(undefined)
  const hat = pickedHat ? pickedHat.hat : stored.hat

  const patch = (next: Partial<RoomSettings>) => setSettings((s) => ({ ...s, ...next }))

  function open() {
    writeIdentity({ name: name.trim() || 'Host', avatarSeed: seed, hat })
    writePendingSettings(settings)
    // Nothing asks a server for a code, because under ADR 0003 there is no
    // server to ask: the code only has to be well-formed and unlikely to clash.
    const [code] = generateCode(Date.now())
    router.push(`/room/${code}`)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.formColumn}>
        <Stack as="main" gap={26} align="center" className={styles.form}>
          <Stack gap={8} className={styles.intro}>
            <h1 className={styles.heading}>{copy.heading}</h1>
            <p className={styles.body}>{copy.body}</p>
          </Stack>

          <Box background="card" radius="modal" padding={26} className={styles.card}>
            <Stack gap={26}>
              <Stack gap={14}>
                <h2 className={styles.section}>{copy.hostSection}</h2>
                <AvatarPicker
                  label="Your face"
                  value={seed}
                  onChange={setPickedSeed}
                  hat={hat}
                />
                <TextField
                  label="Nickname"
                  size="caption"
                  primary
                  value={name}
                  maxLength={20}
                  placeholder="What should we call you?"
                  onChange={(e) => setTypedName(e.target.value)}
                />
              </Stack>

              {/* Its own section, the way the design draws it: "Host info" is
                  who you are, this is what you are wearing. */}
              <HatPicker
                heading
                label={copy.hatLabel}
                body={copy.hatBody}
                value={hat}
                onChange={(next) => setPickedHat({ hat: next })}
              />

              <Stack gap={12}>
                <Stack gap={5}>
                  <h2 className={styles.section}>{copy.modeSection}</h2>
                  <p className={styles.sub}>{copy.modeBody}</p>
                </Stack>
                <div className={styles.modes} role="radiogroup" aria-label={copy.modeSection}>
                  {modeChoices(settings.mode).map((choice) => (
                    <ModeCard
                      key={choice.mode}
                      title={choice.title}
                      body={choice.body}
                      tag={choice.tag}
                      selected={settings.mode === choice.mode}
                      onSelect={() => patch({ mode: choice.mode as GameMode })}
                    />
                  ))}
                </div>

                {/* The design puts the walkthrough right under the choice, because
                    this is where a first-time host is deciding between two formats
                    they have not played yet. It opens on whichever is selected. */}
                <button type="button" className={styles.how} onClick={() => setHelpOpen(true)}>
                  <Icon name="help" size={15} />
                  How this mode works
                </button>
              </Stack>

              <Stack gap={20}>
                <h2 className={styles.section}>{copy.settingsSection}</h2>

                <Toggle
                  label={copy.giphyLabel}
                  checked={settings.giphyEnabled}
                  onChange={(giphyEnabled) => patch({ giphyEnabled })}
                />
                <Toggle
                  label={copy.uniqueLabel}
                  checked={settings.uniqueNicknames}
                  onChange={(uniqueNicknames) => patch({ uniqueNicknames })}
                />
                <hr className={styles.rule} />

                {/* The design drops this row entirely in react mode — there is no
                    caption to format. A value, not a fork. */}
                {showsCaptionFormat(settings.mode) && (
                  <Inline gap={20} justify="between">
                    <span className={styles.rowLabel}>{copy.formatLabel}</span>
                    <SegmentedControl
                      label={copy.formatLabel}
                      surface="card"
                      value={settings.format}
                      onChange={(format) => patch({ format })}
                      options={[
                        { value: 'tb', label: 'Top + bottom' },
                        { value: 'one', label: 'One line' },
                      ]}
                    />
                  </Inline>
                )}

                <Inline gap={20} justify="between">
                  <span className={styles.rowLabel}>{copy.votingLabel}</span>
                  <SegmentedControl
                    label={copy.votingLabel}
                    surface="card"
                    value={settings.voting}
                    onChange={(voting) => patch({ voting })}
                    options={[
                      { value: 'rank', label: 'Rank top 3' },
                      { value: 'single', label: 'Single vote' },
                    ]}
                  />
                </Inline>

                <Stepper
                  label={copy.capLabel}
                  value={settings.capSeconds}
                  format={(n) => `${n} sec`}
                  step={CAP_SECONDS_STEP}
                  min={CAP_SECONDS_MIN}
                  max={CAP_SECONDS_MAX}
                  onChange={(capSeconds) => patch({ capSeconds })}
                />

                <Stepper
                  label={copy.roundsLabel}
                  value={settings.totalRounds}
                  format={(n) => String(n)}
                  min={ROUNDS_MIN}
                  max={ROUNDS_MAX}
                  onChange={(totalRounds) => patch({ totalRounds })}
                />
              </Stack>
            </Stack>
          </Box>
        </Stack>

        {/* The action bar, not the card's last row. Sticky in both layouts:
            below `xl` it pins against the page scroll, from `xl` against this
            column's own — so "Open the room" is never the thing you have to
            scroll two Steppers to find. */}
        <div className={styles.dock}>
          <Button size="form" fullWidth onClick={open}>
            {copy.action}
          </Button>
        </div>
      </div>

      {/* Not `aria-hidden` on the wrapper: the wall inside it already is, and
          the pause control it renders beside the wall is real UI. */}
      <aside className={styles.showcase}>
        <HeroWall tiles={tiles} scrim="soft" />
      </aside>

      {/* Outside `.formColumn` on purpose. That column is a query container,
          which makes it the containing block for `position: fixed` children —
          a modal rendered inside it would be trapped in the 40% and clipped by
          its own overflow. */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} mode={settings.mode} />
    </div>
  )
}
