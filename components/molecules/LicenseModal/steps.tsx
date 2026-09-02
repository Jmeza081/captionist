import type { ModalStep } from '@/components/molecules/Modal'
import styles from './LicenseModal.module.scss'

/**
 * What Captionist is built out of, and on whose terms.
 *
 * Co-located with the component that renders it, the same as `HelpModal`'s.
 * Four steps rather than one wall of text, because `Modal` is a fixed-height
 * card and a licence page that scrolls inside one is a licence page nobody
 * reaches the bottom of — and because these are genuinely four different
 * obligations to four different parties.
 *
 * **Kept honest by hand.** Nothing here is generated from `package.json`: the
 * things that actually carry a condition are the *assets* — the GIFs, the
 * faces, the emoji, the typeface — and a dependency list would bury those four
 * under sixty MIT runtimes that ask for nothing. Change an asset source and
 * this file changes with it.
 */

function Link({ href, children }: { href: string; children: string }) {
  return (
    <a className={styles.link} href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}

export const LICENSE_STEPS: ModalStep[] = [
  {
    eyebrow: 'The app',
    heading: 'Captionist is MIT',
    body: (
      <>
        The game, its components and its design tokens are MIT licensed — use them, fork
        them, ship them. The source is on{' '}
        <Link href="https://github.com/Jmeza081/captionist">GitHub</Link>, licence
        included. The four Slackmoji tiles and the sixteen hats were drawn for this and
        travel with it.
      </>
    ),
  },
  {
    eyebrow: 'The GIFs',
    heading: 'Searched live, never re-hosted',
    body: (
      <>
        Every GIF comes from{' '}
        <Link href="https://klipy.com">KLIPY</Link> — or{' '}
        <Link href="https://giphy.com">Giphy</Link>, where a room is configured for it —
        requested by your browser and never routed, cached or mirrored by us. Their terms
        are theirs:{' '}
        <Link href="https://klipy.com/terms">KLIPY&rsquo;s</Link> and{' '}
        <Link href="https://support.giphy.com/hc/en-us/articles/360020027752-GIPHY-User-Terms-of-Service">
          Giphy&rsquo;s
        </Link>
        . Both marks stay on the picker for that reason.
      </>
    ),
  },
  {
    eyebrow: 'The faces',
    heading: 'Avatars are CC0',
    body: (
      <>
        Player faces are drawn in your browser from a seed by{' '}
        <Link href="https://www.dicebear.com/styles/critters/">DiceBear&rsquo;s critters</Link>{' '}
        style, released under{' '}
        <Link href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</Link> — so
        nothing about where a face appears is constrained. No picture of a player is ever
        stored or sent; the room carries the seed.
      </>
    ),
  },
  {
    eyebrow: 'The rest',
    heading: 'Emoji and type carry credit',
    body: (
      <>
        Reaction art is{' '}
        <Link href="https://googlefonts.github.io/noto-emoji-animation/">
          Noto Animated Emoji
        </Link>{' '}
        by Google, used under{' '}
        <Link href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Link>, which
        asks for exactly this. The typeface is{' '}
        <Link href="https://rsms.me/inter/">Inter</Link> under the{' '}
        <Link href="https://openfontlicense.org/">SIL Open Font License 1.1</Link>.
      </>
    ),
  },
]
