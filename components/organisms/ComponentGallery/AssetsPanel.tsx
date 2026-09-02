'use client'

import { Avatar } from '@/components/atoms/Avatar'
import { Box } from '@/components/atoms/Box'
import { Inline } from '@/components/atoms/Inline'
import { Logo } from '@/components/atoms/Logo'
import { ReactionGlyph } from '@/components/atoms/ReactionGlyph'
import { Stack } from '@/components/atoms/Stack'
import { Wordmark } from '@/components/molecules/Wordmark'
import { AVATAR_SEEDS, seedLabel } from '@/lib/avatar'
import { colorFor } from '@/lib/game/constants'
import { SAMPLE_GIFS } from '@/lib/gifs/samples'
import { CROWN, HAT_IDS, hatArt } from '@/lib/hats'
import { REACTIONS, type ReactionPack } from '@/lib/reactions'
import { Case, Section } from './Section'
import { GifUsage } from './GifUsage'
import styles from './ComponentGallery.module.scss'

/**
 * What the app ships as files, rather than as components.
 *
 * Every one of these is read from the same module the room reads, never from a
 * copy: seventy seeds off `AVATAR_SEEDS`, seventeen hats off `HAT_IDS`, the
 * reaction catalogue off `REACTIONS`, the offline board off `SAMPLE_GIFS`. So a
 * hat added to the picker appears here without anybody remembering to add it,
 * and a tile that has lost its art shows the gap instead of hiding it.
 */

const PACKS: ReadonlyArray<{ id: ReactionPack; label: string }> = [
  { id: 'slackmojis', label: 'Slackmojis' },
  { id: 'smileys', label: 'Smileys' },
  { id: 'objects', label: 'Objects' },
  { id: 'nature', label: 'Nature' },
  { id: 'places', label: 'Places' },
]

/** The hats a player may pick, plus the one the room awards. */
const WEARABLE = [...HAT_IDS, CROWN]

export function AssetsPanel() {
  return (
    <>
      <Section id="faces">
        <Case label="The catalogue — every seed a player can be dealt">
          <p className={styles.note}>
            A seed is a word; the face is drawn from it in the browser, because
            the art must never be what goes on the wire. Same seed, same face,
            on every client — see{' '}
            <code className={styles.code}>docs/adr/0008</code>.
          </p>
          <div className={styles.tileGrid}>
            {AVATAR_SEEDS.map((seed, i) => (
              <figure key={seed} className={styles.tile}>
                <Avatar name={seedLabel(seed)} color={colorFor(i)} avatarSeed={seed} size={46} />
                <figcaption className={styles.tileLabel}>{seed}</figcaption>
              </figure>
            ))}
          </div>
        </Case>
      </Section>

      <Section id="hats">
        <Case label="Sixteen to pick, and the crown the leader wears">
          <div className={styles.tileGrid}>
            {WEARABLE.map((id) => (
              <figure key={id} className={styles.tile}>
                {/* The art on its own, at the size the picker draws it. A hat
                    that has lost its file shows an empty frame here rather
                    than a face that quietly goes bare. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- a
                    committed SVG at a fixed 44px; `next/image` would add a
                    loader to a file that is already the size it is drawn. */}
                <img className={styles.hatArt} src={hatArt(id)} alt="" width={44} height={44} />
                <figcaption className={styles.tileLabel}>{id}</figcaption>
              </figure>
            ))}
          </div>
        </Case>
        <Case label="Worn — the floor is 34px, under which a head goes bare">
          <Inline gap={12} align="center">
            <Avatar name="Vic" color={colorFor(1)} avatarSeed="amber" hat="party" size={30} />
            <Avatar name="Vic" color={colorFor(1)} avatarSeed="amber" hat="party" size={34} />
            <Avatar name="Vic" color={colorFor(1)} avatarSeed="amber" hat="party" size={56} />
            <Avatar name="Vic" color={colorFor(1)} avatarSeed="amber" hat={CROWN} size={56} />
          </Inline>
        </Case>
      </Section>

      <Section id="reactions">
        <Case label="The defaults — what the picker opens on">
          <Inline gap={12} align="center">
            {REACTIONS.slice(0, 10).map((reaction) => (
              <figure key={reaction.id} className={styles.tile}>
                <ReactionGlyph glyph={reaction.glyph} size={30} />
                <figcaption className={styles.tileLabel}>{reaction.label}</figcaption>
              </figure>
            ))}
          </Inline>
        </Case>
        <Case label="The packs — counted from the catalogue, not from memory">
          <Box background="card" radius="card" padding={20}>
            <Stack gap={10}>
              {PACKS.map((pack) => (
                <div key={pack.id} className={styles.packRow}>
                  <span className={styles.packName}>{pack.label}</span>
                  <span className={styles.packCount}>
                    {REACTIONS.filter((r) => r.pack === pack.id).length}
                  </span>
                </div>
              ))}
              <div className={styles.packRow}>
                <span className={styles.packName}>
                  <strong className={styles.strong}>All</strong>
                </span>
                <span className={styles.packCount}>{REACTIONS.length}</span>
              </div>
            </Stack>
          </Box>
          {/*
            CC BY 4.0 asks for credit, and this is where the reaction art is on
            show. See docs/adr/0012 for why the catalog is Google's and not the
            one everybody actually has in their Slack.
          */}
          <p className={styles.credits}>
            Emoji art is{' '}
            <a
              className={styles.creditLink}
              href="https://googlefonts.github.io/noto-emoji-animation/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Noto Animated Emoji
            </a>{' '}
            by Google, used under{' '}
            <a
              className={styles.creditLink}
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer noopener"
            >
              CC BY 4.0
            </a>
            . The four Slackmojis are ours.
          </p>
        </Case>
      </Section>

      <Section id="shelf">
        <Case label="Thirteen tiles — the board with no provider behind it">
          <p className={styles.note}>
            What the picker shows when there is no key, no network, or a spent
            allowance. Each ships twice: the animation, and a still beside it,
            because an SVG used as an image does not reliably inherit the
            page&rsquo;s reduced-motion setting.
          </p>
          <div className={styles.shelfGrid}>
            {SAMPLE_GIFS.map((gif) => (
              <figure key={gif.id} className={styles.shelfTile}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the
                    shelf is committed SVG, served verbatim. */}
                <img className={styles.shelfArt} src={gif.src} alt={gif.alt} />
                <figcaption className={styles.tileLabel}>{gif.alt}</figcaption>
              </figure>
            ))}
          </div>
        </Case>
        <Case label="Still — the same art with the motion taken out">
          <div className={styles.shelfGrid}>
            {SAMPLE_GIFS.slice(0, 4).map((gif) => (
              <figure key={gif.id} className={styles.shelfTile}>
                {/* eslint-disable-next-line @next/next/no-img-element -- as above. */}
                <img className={styles.shelfArt} src={gif.still} alt="" />
                <figcaption className={styles.tileLabel}>{gif.alt} · still</figcaption>
              </figure>
            ))}
          </div>
        </Case>
      </Section>

      <Section id="mark">
        <Case label="The mark alone, at its three sizes">
          <Inline gap={20} align="center">
            <Logo size="header" />
            <Logo size="landing" />
            <Logo size="badge" />
          </Inline>
        </Case>
        <Case label="The lockup — the name is real text, not artwork">
          <Stack gap={20} align="start">
            <Wordmark size="header" />
            <Wordmark size="landing" />
          </Stack>
        </Case>
      </Section>

      <Section id="gif-usage">
        <GifUsage />
      </Section>
    </>
  )
}
