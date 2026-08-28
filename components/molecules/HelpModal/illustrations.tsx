'use client'

import { Avatar } from '@/components/atoms/Avatar'
import { Icon } from '@/components/atoms/Icon'
import { PLAYER_COLORS } from '@/lib/game/constants'
import { SAMPLE_GIFS } from '@/lib/gifs/samples'
import { useReducedMotion } from '@/lib/useReducedMotion'
import styles from './illustrations.module.scss'

/**
 * The walkthrough's rail — a miniature of the screen each step describes.
 *
 * The design (Screens 2e–2h) does not put a stock GIF here. Step 1 is the
 * picked image wearing its "Selected" pill and the picker's chip, step 2 is
 * that *same* image with the caption written over it, step 3 is a vote grid
 * mid-ranking, and step 4 has no image at all — it is the champion. Reading
 * the four in order is watching one round happen.
 *
 * They are drawings, not live components: the design's grid cells carry no
 * labels and its podium is three bars, so composing `MediaCard` and `Podium`
 * at rail scale would mean overriding most of what they draw. What is reused
 * is what genuinely matches — `Avatar` for a player, and the four-way black
 * shadow `MediaCard` puts under caption text.
 *
 * All of it is `aria-hidden`: the heading and body beside it already say what
 * the step is, and a screen reader does not need the picture of the sentence
 * it just read.
 */

/** The design gives Vic yellow and Jack purple; these are those seats. */
const VIC = PLAYER_COLORS[1] ?? '#F6E338'
const JACK = PLAYER_COLORS[2] ?? '#9B7BFF'

/** The round's image, held across steps 1 and 2 so it reads as one round. */
const ROUND = 'prod'

function Art({ slug }: { slug: string }) {
  const still = useReducedMotion()
  const gif = SAMPLE_GIFS.find((g) => g.id === `sample-${slug}`)
  const src = still ? (gif?.still ?? gif?.src) : gif?.src

  // Animated SVG, and decorative: next/image would rasterise it.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.art} src={src} alt="" />
  )
}

/** Caption mode, step 1: the Captionist has locked an image in. */
export function PickIllustration() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <Art slug={ROUND} />
      <span className={styles.scrim} />
      <span className={styles.pill}>Selected</span>
      <span className={styles.chip}>
        <Avatar name="Vic" color={VIC} size={26} />
        Vic is picking
      </span>
    </div>
  )
}

/** Caption mode, step 2: the same image, mid-caption, with the clock running. */
export function CaptionIllustration() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <Art slug={ROUND} />
      <span className={`${styles.meme} ${styles.memeTop}`}>Prod&rsquo;s down again</span>
      <span className={`${styles.meme} ${styles.memeBottom}`}>And I&rsquo;m on call</span>
      <span className={styles.field}>
        <span className={styles.fieldText}>And I&rsquo;m on call</span>
        <span className={styles.fieldClock}>0:41</span>
      </span>
    </div>
  )
}

/** React mode, step 1: one line, no image — which is the whole point. */
export function PromptIllustration() {
  return (
    <div className={`${styles.frame} ${styles.flat}`} aria-hidden="true">
      <p className={styles.prompt}>&ldquo;The deploy that ended the sprint&rdquo;</p>
      <span className={styles.chip}>
        <Avatar name="Vic" color={VIC} size={26} />
        Vic is writing
      </span>
    </div>
  )
}

/** React mode, step 2: a GIF answering the pinned prompt, still anonymous. */
export function AnswerIllustration() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <Art slug="oncall" />
      <span className={styles.scrim} />
      <span className={styles.prompt2}>&ldquo;The deploy that ended the sprint&rdquo;</span>
      <span className={styles.chip}>Answer 3</span>
    </div>
  )
}

/**
 * Both modes, step 3: four entries mid-ranking.
 *
 * First is gold-ringed, second white-ringed, and the two unranked drop back —
 * the same three states `MediaCard` draws in a real vote grid.
 */
export function VoteIllustration() {
  return (
    <div className={styles.grid} aria-hidden="true">
      <span className={`${styles.cell} ${styles.first}`}>
        <Art slug="deploy" />
        <span className={`${styles.rank} ${styles.rankFirst}`}>1</span>
      </span>
      <span className={`${styles.cell} ${styles.second}`}>
        <Art slug="merge" />
        <span className={styles.rank}>2</span>
      </span>
      <span className={`${styles.cell} ${styles.unranked}`}>
        <Art slug="standup" />
      </span>
      <span className={`${styles.cell} ${styles.unranked}`}>
        <Art slug="retro" />
      </span>
    </div>
  )
}

/** Both modes, step 4: the champion, and the podium under them. */
export function PodiumIllustration() {
  return (
    <div className={styles.champion} aria-hidden="true">
      <span className={styles.crown}>
        <Avatar name="Jack" color={JACK} size={88} />
        <span className={styles.star}>
          <Icon name="star" size={26} />
        </span>
      </span>
      <span className={styles.name}>Jack</span>
      <span className={styles.stat}>48 points · 3 rounds won</span>
      <span className={styles.bars}>
        <span className={`${styles.bar} ${styles.barSecond}`}>2</span>
        <span className={`${styles.bar} ${styles.barFirst}`}>1</span>
        <span className={`${styles.bar} ${styles.barThird}`}>3</span>
      </span>
    </div>
  )
}
