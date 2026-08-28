import { Avatar, type AvatarProps } from '@/components/atoms/Avatar'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import styles from './PromptBanner.module.scss'

export interface PromptBannerProps {
  /** The prompt text, without quotes — the component adds curly ones. */
  prompt: string
  /** The Prompter. Omit for the compact variant. */
  author?: Pick<AvatarProps, 'name' | 'color' | 'src' | 'avatarSeed'>
  /** `lg` is the round's hero banner; `sm` sits above a vote grid. */
  size?: 'sm' | 'lg'
  /**
   * Overrides the derived "Vic's prompt". The Prompter's own preview reads
   * "Your prompt" — naming yourself in the third person is the tell that a
   * screen was written for one viewer and reused for another.
   */
  label?: string
}

/**
 * React mode's stand-in for the shared image.
 *
 * Always its own full-width line, never inline beside a heading — it is the
 * thing every answer in the round is responding to.
 */
export function PromptBanner({
  prompt,
  author,
  size = 'sm',
  label,
}: PromptBannerProps) {
  return (
    <div className={`${styles.banner} ${styles[size]}`}>
      {author ? (
        <div className={styles.author}>
          <Avatar {...author} size={size === 'lg' ? 40 : 30} />
          <Eyebrow>{label ?? `${author.name}’s prompt`}</Eyebrow>
        </div>
      ) : (
        <Eyebrow>{label ?? 'Prompt'}</Eyebrow>
      )}

      <p className={styles.quote}>&ldquo;{prompt}&rdquo;</p>
    </div>
  )
}
