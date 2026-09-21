import { Avatar } from '@/components/atoms/Avatar'
import { Stack } from '@/components/atoms/Stack'
import { HeroWall } from '@/components/molecules/HeroWall'
import { LandingLegal } from '@/components/molecules/LandingLegal'
import { LandingNav } from '@/components/molecules/LandingNav'
import { LandingActions } from '@/components/organisms/LandingActions'
import { PLAYER_COLORS } from '@/lib/game/constants'
import { fetchReleases } from '@/lib/releases.server'
import styles from './page.module.scss'

/**
 * The public front door.
 *
 * A Server Component, and the wall is resolved before a byte reaches the
 * browser: the tiles arrive in the first HTML at their final size, so there is
 * no client fetch waterfall and nothing shifts when the media lands. The only
 * client code on the page is the wall's motion control and the join field.
 */

const REPO = 'https://github.com/Jmeza081/captionist'

/**
 * The design's overlapping avatar stack.
 *
 * The first five faces of the picker's catalogue, on the first five seat
 * colours — so the proof row is literally "here are five of the faces you can
 * pick", rather than five arbitrary ones.
 */
const FACES = [
  { name: 'Vic', seed: 'ember' },
  { name: 'Jesska', seed: 'sunfish' },
  { name: 'Melania', seed: 'orbit' },
  { name: 'Lukasz', seed: 'lagoon' },
  { name: 'Jack', seed: 'moss' },
] as const

export default async function HomePage() {
  /*
    The changelog, resolved before a byte reaches the browser.

    Cached for an hour by the framework, so this is one GitHub request per hour
    per deployment rather than one per visitor — which is what keeps a page
    with no API key of its own clear of the 60-an-hour anonymous limit. It
    cannot throw: `fetchReleases` answers with a status either way, because a
    changelog must never be the reason the front door fails to render.
  */
  const releases = await fetchReleases()

  return (
    <div className={styles.page}>
      <HeroWall />

      <div className={styles.content}>
        <LandingNav joinHref="/join" repoHref={REPO} releases={releases} />

        <Stack as="main" align="center" gap={0} className={styles.hero}>
          <h1 className={styles.headline}>
            Caption this.
            <br />
            Ship that.
          </h1>

          <p className={styles.lead}>
            The five-minute standup warmup for engineering teams. Someone picks a GIF,
            everyone writes the worst possible caption, and the room decides who commits
            straight to main.
          </p>

          <div className={styles.cta} id="join">
            <LandingActions />
          </div>

          <div className={styles.proof}>
            <span className={styles.faces}>
              {FACES.map((face, i) => (
                <span key={face.name} className={styles.face}>
                  <Avatar
                    name={face.name}
                    avatarSeed={face.seed}
                    color={PLAYER_COLORS[i % PLAYER_COLORS.length] ?? '#FF787D'}
                    size={34}
                  />
                </span>
              ))}
            </span>
            <span className={styles.proofText}>
              3–20 players · no install · works in a Zoom share
            </span>
          </div>
        </Stack>

        {/* The licences a production deploy carries, one click from the front
            door: the GIF providers' terms, CC0 for the faces, CC BY for the
            reaction art and OFL for the type. The repository is the nav's
            `GitHub`, and is deliberately not repeated here. */}
        <LandingLegal />
      </div>
    </div>
  )
}
