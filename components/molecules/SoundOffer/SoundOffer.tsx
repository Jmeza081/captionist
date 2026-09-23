import { Button } from '@/components/atoms/Button'
import { CloseButton } from '@/components/atoms/CloseButton'
import { Icon } from '@/components/atoms/Icon'
import styles from './SoundOffer.module.scss'

export interface SoundOfferProps {
  /** Must unlock audio synchronously — this tap is the gesture the browser wants. */
  onAccept: () => void
  onDecline: () => void
}

/**
 * The lobby asking, once, whether you want sound.
 *
 * **Everybody gets asked, and only once.** Most rooms are remote, so each
 * person hears their own device and nobody's music is anybody else's problem —
 * but the room is silent until a tap says otherwise, because a browser will
 * not play a note before one. Either answer puts this away for good; the
 * toolbox is where you change your mind.
 *
 * **One row on a phone, a card above `md`.** The host's phone lobby is packed
 * to the pixel — a share card, the mode toggle, and a start button pinned to
 * the foot with the floating keys stacked on it — so a card that wrapped to
 * four lines pushed the mode toggle under the chat key. On a phone the reason
 * goes and "Keep it quiet" becomes the close key; both answers are still
 * there. Both declines are rendered and CSS shows one, the way `RoomToolbox`
 * picks between its pill and its key.
 *
 * **Secondary, not primary.** The host's lobby already has its one primary
 * button — the one that starts the game — and this does not advance anything.
 */
export function SoundOffer({ onAccept, onDecline }: SoundOfferProps) {
  return (
    <section className={styles.offer} aria-labelledby="sound-offer-title">
      <span className={styles.mark} aria-hidden="true">
        <Icon name="music" size={18} />
      </span>
      <div className={styles.copy}>
        <h2 id="sound-offer-title" className={styles.title}>
          Sound is off
        </h2>
        <p className={styles.body}>
          Music and sound effects, in step with the room. Mute them any time from the toolbox.
        </p>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" size="small" onClick={onAccept}>
          Turn sound on
        </Button>
        <Button variant="ghost" size="small" className={styles.declineText} onClick={onDecline}>
          Keep it quiet
        </Button>
        <CloseButton className={styles.declineKey} label="Keep it quiet" onClick={onDecline} />
      </div>
    </section>
  )
}
