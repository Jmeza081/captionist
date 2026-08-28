/**
 * Imports Google's Noto Animated Emoji into the room's reaction catalog.
 *
 * Run by hand, output committed:
 *
 *     node scripts/import-noto-emoji.mjs
 *
 * Deliberately *not* wired into `build`. The build has no network, and 586
 * files that change roughly never have no business being fetched on every
 * deploy. What lands in the tree is `public/media/emoji/*.svg` plus the
 * generated `lib/reactions.catalog.ts`.
 *
 * **Why Noto and not slackmojis.com** — see `docs/adr/0012`. The short version:
 * slackmojis.com's terms forbid compiling their directory, and they don't own
 * the art anyway. Noto Animated Emoji is CC BY 4.0, Google-authored, and served
 * from a CDN built for hotlinking.
 *
 * Only the *still* SVG is downloaded. The animated rendition is 369KB (Google
 * publishes no smaller raster), so it is layered from `fonts.gstatic.com` at
 * runtime by `ReactionGlyph` rather than committed. See `lib/noto.ts`.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public/media/emoji')
const CATALOG = join(ROOT, 'lib/reactions.catalog.ts')
const CURATED = join(ROOT, 'lib/reactions.ts')

const INDEX = 'https://googlefonts.github.io/noto-emoji-animation/data/api.json'
const asset = (codepoint, file) =>
  `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoint}/${file}`

/** Skin-tone modifiers. Five copies of one gesture is file count, not range. */
const SKIN_TONE = /1f3f[b-f]/

/**
 * Noto's nine categories, folded into the four packs the picker can show.
 *
 * The picker's tab row has room for six chips including Recent and Slackmojis,
 * so nine source categories have to become four. Grouped by what someone
 * reaching for a reaction would guess, not by Unicode's taxonomy.
 */
const PACKS = {
  'Smileys and emotions': 'smileys',
  People: 'smileys',
  'Animals and nature': 'nature',
  'Food and drink': 'nature',
  Objects: 'objects',
  Symbols: 'objects',
  'Travel and places': 'places',
  'Activities and events': 'places',
  Flags: 'places',
}

/** Downloads in flight. Google is fine with this; being rude to it is not. */
const CONCURRENCY = 12

/**
 * The emoji characters the curated 32 already use.
 *
 * 25 of the 32 are also in Noto, and `lib/reactions.test.ts` asserts that no
 * two reactions share an id, a label *or* a glyph — so importing them again
 * would fail `verify` rather than fail quietly. Read out of the source rather
 * than duplicated here, because a second hand-maintained list is a second thing
 * to forget. If the parse ever comes back empty the shape has changed, and
 * that's a hard error rather than an import that silently duplicates 25 tiles.
 */
async function curatedCodepoints() {
  const src = await readFile(CURATED, 'utf8')
  const glyphs = [...src.matchAll(/glyph: '([^']+)'/g)]
    .map((m) => m[1])
    .filter((g) => !g.startsWith('/'))

  if (glyphs.length < 20) {
    throw new Error(
      `Only found ${glyphs.length} curated emoji in lib/reactions.ts — expected 20+. ` +
        `The shape of REACTIONS changed; fix this parse before importing.`,
    )
  }

  const out = new Set()
  for (const glyph of glyphs) {
    const cp = [...glyph].map((c) => c.codePointAt(0).toString(16)).join('_')
    // Noto is inconsistent about the variation selector, so match with and
    // without it rather than trusting one spelling.
    out.add(cp)
    out.add(cp.replace(/_fe0f$/, ''))
    out.add(`${cp}_fe0f`)
  }
  return out
}

/** `1f3f3_fe0f` → `1f3f3-fe0f`, so it matches the allowlist's `[a-z0-9-]+`. */
const slugOf = (codepoint) => codepoint.replace(/_/g, '-')

/** `:rolling-on-the-floor-laughing:` → `Rolling on the floor laughing`. */
function labelOf(tag) {
  const words = tag.replace(/:/g, '').replace(/[-_]/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Every word anyone might type to find it, deduped and lowercased. */
function keywordsOf(tags) {
  const out = new Set()
  for (const tag of tags) {
    const bare = tag.replace(/:/g, '').trim()
    if (!bare) continue
    out.add(bare.replace(/_/g, '-'))
    for (const word of bare.split(/[-_\s]+/)) if (word) out.add(word)
  }
  return [...out]
}

/**
 * Refuses anything that could do something in an `<img>`.
 *
 * An `<img>` is already a passive context, so this is belt-and-braces — but
 * these files are fetched from the network and committed unread, and "we looked"
 * is cheap insurance against the day the CDN serves something unexpected.
 */
function assertInert(svg, codepoint) {
  const banned = /<script|<foreignObject|<iframe|\son\w+\s*=|javascript:/i
  if (banned.test(svg)) throw new Error(`${codepoint}: SVG contains active content`)
  // `xlink:href="#id"` (internal refs) is fine; anything absolute is not.
  const external = /(?:xlink:)?href\s*=\s*["'](?!#)/i
  if (external.test(svg)) throw new Error(`${codepoint}: SVG references an external resource`)
}

/** Strips the XML prolog, the Illustrator banner, and inter-tag whitespace. */
function minify(svg) {
  return svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim()
}

/** A single-quoted TS string literal, escaped properly rather than hopefully. */
const q = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.text()
}

/**
 * Same, but `null` for a 404.
 *
 * The index lists a handful of codepoints — ®, ™ and friends — that have an
 * animation but no still. This design renders the still first and treats the
 * animation as the upgrade, so one without the other is no use to us.
 */
async function fetchTextIfPublished(url) {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.text()
}

/** Runs `worker` over `items` at most `limit` at a time. */
async function pooled(items, limit, worker) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await worker(items[i], i)
      }
    }),
  )
  return out
}

async function main() {
  console.log('Fetching the Noto Animated Emoji index…')
  const { icons } = JSON.parse(await fetchText(INDEX))
  console.log(`  ${icons.length} published`)

  // 1. Skin-tone variants add file count, not expressive range.
  let picked = icons.filter((i) => !SKIN_TONE.test(i.codepoint))
  console.log(`  ${picked.length} after dropping skin-tone variants`)

  // 2. One entry per shortcode, keeping whichever Google ranks highest.
  const byTag = new Map()
  for (const icon of picked) {
    const tag = icon.tags[0]
    const held = byTag.get(tag)
    if (!held || icon.popularity > held.popularity) byTag.set(tag, icon)
  }
  picked = [...byTag.values()]
  console.log(`  ${picked.length} after deduping by shortcode`)

  // 3. Anything the curated 32 already covers.
  const curated = await curatedCodepoints()
  picked = picked.filter((i) => !curated.has(i.codepoint))
  console.log(`  ${picked.length} after dropping collisions with the curated set`)

  // Sort by popularity so the packs open on what people actually reach for.
  picked.sort((a, b) => b.popularity - a.popularity)

  console.log(`\nDownloading ${picked.length} still SVGs…`)
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  let bytes = 0
  let done = 0
  const withGaps = await pooled(picked, CONCURRENCY, async (icon) => {
    const raw = await fetchTextIfPublished(asset(icon.codepoint, 'emoji.svg'))
    if (raw === null) return null

    const svg = minify(raw)
    assertInert(svg, icon.codepoint)

    const slug = slugOf(icon.codepoint)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error(`${icon.codepoint}: slug "${slug}" would fail the image allowlist`)
    }

    await writeFile(join(OUT_DIR, `${slug}.svg`), svg, 'utf8')
    bytes += Buffer.byteLength(svg)

    done += 1
    if (done % 100 === 0) console.log(`  ${done}/${picked.length}`)

    const pack = PACKS[icon.categories[0]]
    if (!pack) throw new Error(`${icon.codepoint}: unmapped category "${icon.categories[0]}"`)

    return {
      id: `noto-${slug}`,
      glyph: `/media/emoji/${slug}.svg`,
      keywords: keywordsOf(icon.tags),
      label: labelOf(icon.tags[0]),
      pack,
    }
  })

  const entries = withGaps.filter(Boolean)
  const skipped = withGaps.length - entries.length
  if (skipped > 0) {
    console.log(`\n  skipped ${skipped} with no still published (animation only)`)
  }

  // The unit tests assert these across the merged list; failing here names the
  // offender instead of leaving `verify` to say only that something collided.
  for (const field of ['id', 'glyph', 'label']) {
    const seen = new Map()
    for (const e of entries) {
      if (seen.has(e[field])) {
        throw new Error(`Duplicate ${field} "${e[field]}": ${seen.get(e[field])} and ${e.id}`)
      }
      seen.set(e[field], e.id)
    }
  }

  const packs = {}
  for (const e of entries) packs[e.pack] = (packs[e.pack] ?? 0) + 1

  const header = `/**
 * Google's Noto Animated Emoji, as reactions.
 *
 * GENERATED by \`scripts/import-noto-emoji.mjs\`. Do not edit by hand — re-run
 * the script. The still SVGs beside it in \`public/media/emoji/\` are generated
 * by the same pass, so the two are only ever right together.
 *
 * Art is Google's, licensed CC BY 4.0 — see \`public/media/emoji/LICENSE.txt\`.
 *
 * Every glyph here is the *still*. The animated rendition is 369KB and lives on
 * Google's CDN; \`lib/noto.ts\` derives that URL and \`ReactionGlyph\` decides
 * whether to reach for it.
 */

import type { Reaction } from './reactions'

export const NOTO_REACTIONS: readonly Reaction[] = [
`

  const body = entries
    .map(
      (e) =>
        `  { id: ${q(e.id)}, glyph: ${q(e.glyph)}, kind: 'image', ` +
        `keywords: [${e.keywords.map(q).join(', ')}], ` +
        `label: ${q(e.label)}, pack: ${q(e.pack)} },`,
    )
    .join('\n')

  await writeFile(CATALOG, `${header}${body}\n]\n`, 'utf8')

  console.log(`\nWrote ${entries.length} reactions`)
  console.log(`  ${OUT_DIR} — ${(bytes / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  ${CATALOG}`)
  console.log(`  packs: ${Object.entries(packs).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
}

await main()
