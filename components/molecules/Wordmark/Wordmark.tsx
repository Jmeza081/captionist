import { Logo } from '@/components/atoms/Logo'
import styles from './Wordmark.module.scss'

export interface WordmarkProps {
  /**
   * Which lockup the design draws. `header` is the in-room topbar's 26px mark;
   * `landing` the 34px front door, which the boot interstitial shares.
   *
   * Passed straight through to `Logo`, so the mark and the type can never
   * disagree about which lockup this is.
   */
  size?: 'header' | 'landing'
  /**
   * Show the name on a phone too.
   *
   * The in-room bar hides it below `md` — a phone header carries where you are
   * and how long is left, and the name is the part no round needs. The lobby is
   * the exception the rule was always going to meet: it has no phase and no
   * clock, so the bar has the room, and it is the one screen somebody lands on
   * without knowing what they have joined.
   */
  showName?: boolean
}

/**
 * The mark and the name, together.
 *
 * Extracted because it was inlined three times — the room's topbar, the
 * landing bar, and now the boot interstitial — and the third copy is the one
 * that makes a shared atom cheaper than a shared convention.
 *
 * The name is real text rather than part of the artwork: it is the only place
 * the app says what it is called, and a screen reader should hear it. `Logo`
 * stays `aria-hidden`, so the lockup announces once.
 */
export function Wordmark({ size = 'header', showName = false }: WordmarkProps) {
  return (
    <span
      className={[styles.lockup, styles[size], showName ? styles.named : '']
        .filter(Boolean)
        .join(' ')}
    >
      <Logo size={size} />
      <span className={styles.name}>Captionist</span>
    </span>
  )
}
