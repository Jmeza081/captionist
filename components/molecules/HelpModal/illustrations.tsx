'use client'

import { Avatar } from '@/components/atoms/Avatar'
import { Icon } from '@/components/atoms/Icon'
import { TvStatic } from '@/components/atoms/TvStatic'
import { TunedImage } from '@/components/molecules/TunedImage'
import { PLAYER_COLORS } from '@/lib/game/constants'
import type { GameMode } from '@/lib/game/types'
import { HELP_ART, HELP_SLUGS, type HelpArtRole } from '@/lib/gifs/art'
import { useResolvedArt } from '@/lib/gifs/useArt'
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
 * **The pictures inside them are real GIFs.** They were house SVGs with an
 * emoji in the middle, which is precisely the wrong thing to show somebody who
 * is reading a walkthrough of a game about GIFs. The six are curated by name in
 * `lib/gifs/art.ts` and resolved in the browser, on the same terms as the
 * landing wall and the waiting backdrop — the SVG is still what paints first
 * and what a keyless clone keeps.
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

/**
 * One picture, arriving on a television rather than into a hole.
 *
 * Three states, in the order a viewer meets them:
 *
 *   1. **The lookup is out** — a set tuned to a channel that has not arrived.
 *      It used to be the committed SVG here, which is a 🚀 on a gradient, and
 *      on the one screen whose job is telling somebody the game is about GIFs
 *      an emoji placeholder is the wrong promise to make for 300ms.
 *   2. **A URL landed, the bytes have not** — the same set, now behind the
 *      picture, dropped the moment it paints. That is `TunedImage`, which is
 *      what every other remote GIF in the app already uses.
 *   3. **The lookup settled on nothing** — stubbed, keyless, or the suite —
 *      and the committed SVG comes back. A set hissing forever is the honest
 *      picture of a fetch that failed, and the wrong one for a walkthrough
 *      that is simply running without a provider.
 *
 * `fallback` is a `SAMPLE_GIFS` slug rather than a second `role`, because the
 * offline shelf is not a parallel catalogue of the curated six — it is twelve
 * house drawings, and which of them stands in for which step is this file's
 * business rather than `art.ts`'s.
 *
 * Matched on `id`, never on position: `resolveArt` drops a slug the provider
 * no longer has, so an index into the returned list silently shifts every
 * picture after the missing one along by one.
 */
function Art({ role, fallback }: { role: HelpArtRole; fallback: string }) {
  const still = useReducedMotion()
  const { art, pending } = useResolvedArt(HELP_SLUGS)
  const resolved = art?.find((g) => g.id === HELP_ART[role])
  const stub = SAMPLE_GIFS.find((g) => g.id === `sample-${fallback}`)
  // The stand-in only after the lookup has settled. While it is out the set is
  // the honest answer: something is coming.
  const gif = resolved ?? (pending ? undefined : stub)
  const src = still ? (gif?.still ?? gif?.src) : gif?.src

  return (
    <span className={styles.artFrame}>
      {src ? (
        <TunedImage
          // The zoom that crops the stand-in's printed title belongs to the
          // stand-in alone — see the stylesheet. A resolved GIF has no title
          // burnt into it and would just be cropped for nothing.
          className={`${styles.art} ${resolved ? '' : styles.stub}`}
          src={src}
          alt=""
        />
      ) : (
        <>
          {/* Its own field per illustration, so four cells in the vote grid
              read as four sets rather than one sheet of noise behind a
              grille. */}
          <TvStatic seed={HELP_SLUGS.indexOf(HELP_ART[role])} />
          {/* `TvStatic` is never shown raw — `HeroWall`, `SceneBackdrop` and
              `TunedImage` all veil it, and here the rail sits beside display
              type in a modal, which is the loudest place in the app to put a
              field of full-brightness noise. */}
          <span className={styles.veil} />
        </>
      )}
    </span>
  )
}

/** Caption mode, step 1: the Captionist has locked an image in. */
export function PickIllustration() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <Art role="round" fallback="prod" />
      <span className={styles.scrim} />
      <span className={styles.pill}>Selected</span>
      <span className={styles.chip}>
        <Avatar name="Vic" color={VIC} size={26} />
        Vic is picking
      </span>
    </div>
  )
}

/**
 * Caption mode, step 2: the same image, wearing both lines.
 *
 * No composer under it any more. The design draws the field there, and on a
 * screen that is *demonstrating* a top and a bottom line it was a third copy of
 * the bottom one — the meme text says the caption, the body copy beside it says
 * "you get a top and a bottom line", and the field repeated the second of them
 * over a clock nothing in this step is counting.
 */
export function CaptionIllustration() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <Art role="round" fallback="prod" />
      <span className={`${styles.meme} ${styles.memeTop}`}>Prod&rsquo;s down again</span>
      <span className={`${styles.meme} ${styles.memeBottom}`}>And I&rsquo;m on call</span>
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
      <Art role="answer" fallback="oncall" />
      <span className={styles.scrim} />
      <span className={styles.prompt2}>&ldquo;The deploy that ended the sprint&rdquo;</span>
      <span className={styles.chip}>Answer 3</span>
    </div>
  )
}

/**
 * One entry in the vote grid, before it is drawn.
 *
 * The two modes differ here and nowhere else in the step, so they differ as
 * *values* rather than as two components — the rule the whole app is built on.
 */
interface VoteCell {
  role: HelpArtRole
  fallback: string
  /** Caption mode only. React mode's entries are the pictures. */
  caption?: string
}

/**
 * Caption mode's four entries — four captions over **one** image.
 *
 * This is the correction that matters. The step used to draw four different
 * GIFs in both modes, which is right for react and wrong for caption: in
 * caption mode the Captionist picks one image and everybody writes over that
 * same image, so a grid of four pictures says the room is ranking four GIFs.
 * Somebody reading the walkthrough to find out what the format is would have
 * come away with the other format.
 *
 * The image is `round`, the same one steps 1 and 2 use, so the four steps still
 * read as one round happening — and the second line is the one step 2 shows
 * being typed, which is now sitting in the grid being ranked.
 */
const CAPTION_ENTRIES: readonly string[] = [
  'Works on my machine',
  'And I’m on call',
  'Ship it Friday',
  'The retro will fix it',
]

/** React mode's four entries — four GIFs, and no words on any of them. */
const ANSWER_ENTRIES: readonly VoteCell[] = [
  { role: 'vote1', fallback: 'deploy' },
  { role: 'vote2', fallback: 'merge' },
  { role: 'vote3', fallback: 'standup' },
  { role: 'vote4', fallback: 'retro' },
]

function voteCells(mode: GameMode): readonly VoteCell[] {
  if (mode !== 'caption') return ANSWER_ENTRIES
  return CAPTION_ENTRIES.map((caption) => ({ role: 'round', fallback: 'prod', caption }))
}

/** Ranked first, ranked second, then the two nobody has placed yet. */
const RANK_STATE: readonly string[] = [styles.first, styles.second]

/**
 * Both modes, step 3: four entries mid-ranking.
 *
 * First is gold-ringed, second white-ringed, and the two unranked drop back —
 * the same three states `MediaCard` draws in a real vote grid. What each entry
 * *is* comes from the mode: four captions over one image, or four GIFs.
 */
export function VoteIllustration({ mode }: { mode: GameMode }) {
  const cells = voteCells(mode)

  return (
    <div className={styles.grid} aria-hidden="true">
      {cells.map((cell, i) => (
        <span
          key={cell.caption ?? cell.role}
          className={`${styles.cell} ${RANK_STATE[i] ?? styles.unranked}`}
        >
          <Art role={cell.role} fallback={cell.fallback} />
          {cell.caption && <span className={styles.tileMeme}>{cell.caption}</span>}
          {i < 2 && (
            <span className={`${styles.rank} ${i === 0 ? styles.rankFirst : ''}`}>{i + 1}</span>
          )}
        </span>
      ))}
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
