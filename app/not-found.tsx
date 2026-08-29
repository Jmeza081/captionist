import Link from 'next/link'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Grid } from '@/components/atoms/Grid'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { TallyPill } from '@/components/atoms/TallyPill'
import { MediaCard } from '@/components/molecules/MediaCard'
import { Wordmark } from '@/components/molecules/Wordmark'
import { notFoundGif } from '@/lib/gifs/notFound'
import { labelFor } from '@/lib/reactions'
import styles from './not-found.module.scss'

/**
 * Every URL this app doesn't have.
 *
 * A root `not-found.tsx` catches both halves of the problem: an unmatched URL,
 * and any `notFound()` a route throws — so a room code that was never a room
 * lands here rather than on Next's default black page.
 *
 * The markup lives in the route rather than in an organism for the same reason
 * the landing page's does: it is built for exactly one page, and
 * components/README.md says a one-page component is covered by that page's
 * spec instead of by the gallery. Everything with a second call site — the
 * card, the wordmark, the buttons — is already a component.
 *
 * A Server Component, and nothing on it is interactive beyond two links.
 */

/**
 * The room's verdict on a page nobody could caption.
 *
 * Both glyphs are real entries in `REACTIONS`, so `labelFor` gives the screen
 * reader "Skull" and "Melting" rather than reading the characters out.
 */
const TALLIES = [
  { glyph: '💀', count: 7 },
  { glyph: '🫠', count: 4 },
] as const

export default function NotFound() {
  const gif = notFoundGif()

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.mark} aria-label="Captionist, home">
        <Wordmark size="landing" />
      </Link>

      <Grid
        as="main"
        columns={1}
        mdColumns={2}
        gap={52}
        className={styles.body}
      >
        <Stack gap={34} className={styles.copy}>
          <Stack gap={20}>
            <Eyebrow>Error 404</Eyebrow>
            <h1 className={styles.headline}>Nobody could caption this page.</h1>
          </Stack>

          <p className={styles.lead}>
            We put this URL up for three rounds. Zero submissions. The room voted
            to pretend it never existed.
          </p>

          <Stack gap={26}>
            <Inline gap={12} className={styles.actions}>
              <Button size="form" href="/">
                Take me home
              </Button>
              <Button size="form" variant="secondary" href="/host">
                Start a game instead
              </Button>
            </Inline>

            <p className={styles.score}>Points awarded this round: 0. Shameful.</p>
          </Stack>
        </Stack>

        <div className={styles.entry}>
          <MediaCard
            src={gif.src}
            alt={gif.alt}
            topText="The page you asked for"
            tallies={TALLIES.map((tally) => (
              <TallyPill
                key={tally.glyph}
                glyph={tally.glyph}
                count={tally.count}
                context="media"
                label={labelFor(tally.glyph)}
              />
            ))}
          />
          <p className={styles.credit}>
            Submitted by nobody · won by default · still the funniest thing on
            this page
          </p>
        </div>
      </Grid>
    </div>
  )
}
