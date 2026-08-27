import { Avatar, type AvatarProps } from '@/components/atoms/Avatar'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import styles from './RoundOpener.module.scss'

export type GameMode = 'caption' | 'react'

export interface RoundOpenerProps {
  round: number
  totalRounds: number
  mode: GameMode
  /** The headline — "Vic writes the prompt." */
  headline: string
  /** The line under it — what everyone else does. */
  subline: string
  /** Whoever holds the role this round. */
  roleHolder: Pick<AvatarProps, 'name' | 'color' | 'src'>
  onSkip?: () => void
}

/** The role name for each mode. Branched here, not by forking the component. */
const ROLE_NAME: Record<GameMode, string> = {
  caption: 'Captionist',
  react: 'Prompter',
}

const MODE_NAME: Record<GameMode, string> = {
  caption: 'Caption the image',
  react: 'React to the caption',
}

/**
 * The interstitial before each round: round, mode, role and holder.
 *
 * The only place the mode is restated mid-game, which is why it always names
 * the mode even though the header carries it too.
 */
export function RoundOpener({
  round,
  totalRounds,
  mode,
  headline,
  subline,
  roleHolder,
  onSkip,
}: RoundOpenerProps) {
  return (
    <div className={styles.card} role="dialog" aria-label={`Round ${round}`}>
      <Eyebrow tone="muted">
        Round {round} of {totalRounds}
      </Eyebrow>

      <span className={styles.modePill}>
        <span className={styles.modeDot} aria-hidden="true" />
        {MODE_NAME[mode]}
      </span>

      <h2 className={styles.headline}>{headline}</h2>
      <p className={styles.subline}>{subline}</p>

      <div className={styles.role}>
        <Avatar {...roleHolder} size={30} />
        <Eyebrow tone="muted">
          {ROLE_NAME[mode]} · {roleHolder.name}
        </Eyebrow>
      </div>

      {onSkip && (
        <button type="button" className={styles.skip} onClick={onSkip}>
          Skip the intro
        </button>
      )}
    </div>
  )
}
