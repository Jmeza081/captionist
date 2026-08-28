/**
 * Where a Noto reaction's animation lives.
 *
 * The catalog's glyphs are *stills*, committed under `public/media/emoji/` so
 * the room has reactions with no network, no credentials and no third party —
 * the same reason the offline sample shelf exists. The animation is the
 * upgrade, and it is the one thing we do not host: Google publishes these at
 * 512px and nothing smaller, so a single animated tile is ~369KB. Committing
 * 584 of those is ~57MB; pointing at Google's CDN for the handful actually on
 * screen costs nothing until it is.
 *
 * The art is CC BY 4.0 and `fonts.gstatic.com` answers with
 * `access-control-allow-origin: *` and a 48h/7d cache policy, so this is the
 * intended way to use it rather than a borrowed one.
 *
 * **This URL is never sent over the wire.** The lane carries the same-origin
 * still, exactly as before, and every browser derives the animation locally
 * from it. So `isAllowedImageSrc` still has no remote host to trust beyond
 * Giphy, and no player can aim anyone's browser at a URL of their choosing.
 */

/** `/media/emoji/1f3f3-fe0f.svg` → `1f3f3-fe0f`. Nothing else matches. */
const NOTO_GLYPH = /^\/media\/emoji\/([a-z0-9-]+)\.svg$/

/**
 * The animated rendition of a still glyph, or `null` if there isn't one.
 *
 * `null` for the four house Slackmojis and for every emoji character, both of
 * which already animate on their own terms — the Slackmojis are authored SVGs
 * with their own keyframes, and a character is a character.
 */
export function animatedSrcFor(glyph: string): string | null {
  const match = NOTO_GLYPH.exec(glyph)
  if (!match) return null
  // The catalog spells codepoints with dashes so they clear the image
  // allowlist's character class; Google spells them with underscores.
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${match[1].replace(/-/g, '_')}/512.webp`
}
