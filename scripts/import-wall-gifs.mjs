/**
 * Fills the landing wall with real Giphy GIFs, once.
 *
 * Run by hand, output committed:
 *
 *     node scripts/import-wall-gifs.mjs
 *
 * Deliberately *not* wired into `build`, for the same reason
 * `import-noto-emoji.mjs` isn't: the build has no network, and a wall that
 * changes roughly never has no business being fetched on every deploy. What
 * lands in the tree is `lib/gifs/wall.catalog.ts`.
 *
 * **Why a script and not a runtime fetch** — the wall renders on `/`, `/host`,
 * `/join` and `/join/[code]`. Giphy forbids proxying (so it cannot be fetched
 * on the server) and forbids caching (so the hour-long `revalidate` that used
 * to make it affordable is gone). Fetching it client-side would therefore be
 * one API call per visitor on the app's four highest-traffic routes, against a
 * free allowance of a hundred an hour. See ADR-0020.
 *
 * **The honest caveat.** What this commits is a list of media URLs obtained
 * from the API, and Giphy's terms say not to cache media URLs without
 * approval. A single editorially-chosen asset — `backdrop.ts`, `notFound.ts` —
 * is comfortably the "hot-link one GIF" case their own docs sanction; twenty
 * pulled from `trending` is the same act at a scale that starts to look like a
 * cached search. Treat the output as a starting point to *curate*: keep the
 * ones that suit the page, replace the rest by hand from giphy.com, and the
 * committed file is an editorial selection rather than a scrape. If the room
 * ever gets a production key, ask about this at the same time.
 *
 * Costs one API call per run.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'lib/gifs/wall.catalog.ts')

/** `HeroWall`'s grid declares exactly twenty tracks. See `wall.ts`. */
const WALL_SIZE = 20
const QUERY = 'reaction'

/**
 * The key, from the environment or `.env.local`.
 *
 * Read here rather than required in the shell so this works the same way the
 * app does. Accepts the legacy name too, because a checkout that predates
 * ADR-0020 still has `GIPHY_API_KEY` in its `.env.local`.
 */
async function apiKey() {
  const fromEnv =
    process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? process.env.GIPHY_API_KEY
  if (fromEnv) return fromEnv

  try {
    const file = await readFile(join(ROOT, '.env.local'), 'utf8')
    for (const name of ['NEXT_PUBLIC_GIPHY_API_KEY', 'GIPHY_API_KEY']) {
      const line = file.match(new RegExp(`^${name}=(.*)$`, 'm'))
      const value = line?.[1]?.trim().replace(/^["']|["']$/g, '')
      if (value) return value
    }
  } catch {
    // No `.env.local` is a fine state; the message below covers it.
  }
  return undefined
}

/**
 * A last line of defence on top of `rating=pg-13`.
 *
 * Not theoretical: the first run of this script returned a tile whose own alt
 * text was "Masturbating GIF", *through* the PG-13 filter. This is a landing
 * page for a game people play at work, so the rating parameter alone is not
 * something to trust. It is a blunt instrument and it is meant to be — the
 * real filter is a human reading the output before committing it.
 */
const BLOCKED =
  /\b(masturbat|sex|sexy|nsfw|porn|nude|naked|twerk|boob|butt|orgasm|horny|erotic|strip)/i

function tileFrom(item) {
  const images = item.images ?? {}
  const rendition = images.fixed_width ?? images.original ?? {}
  const still = images.fixed_width_still?.url ?? images.original_still?.url
  const poster = still ?? rendition.url
  if (!item.id || !poster) return undefined

  const alt = [item.alt_text, item.title].map((s) => s?.trim()).find(Boolean) ?? 'A GIF'
  if (BLOCKED.test(alt)) return undefined
  return {
    id: item.id,
    poster,
    // Preferred: a tenth the bytes of the equivalent GIF, and it decodes on
    // the video path rather than the main thread. Twenty run at once here.
    mp4: rendition.mp4,
    motion: rendition.mp4 ? undefined : rendition.url,
    alt,
  }
}

const key = await apiKey()
if (!key) {
  console.error(
    'No Giphy key found.\n\n' +
      'Set NEXT_PUBLIC_GIPHY_API_KEY in .env.local (see .env.example), then re-run.\n' +
      'Without it the wall stays on the offline shelf, which is a working state —\n' +
      'not an error.',
  )
  process.exit(1)
}

const params = new URLSearchParams({
  api_key: key,
  q: QUERY,
  limit: String(WALL_SIZE),
  offset: '0',
  // The same unconditional filter the picker uses. A landing page is the one
  // surface nobody chose to look at.
  rating: 'pg-13',
  lang: 'en',
  bundle: 'messaging_non_clips',
})

const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`)
if (!response.ok) {
  console.error(
    response.status === 429
      ? 'Giphy says the hourly allowance is spent. Try again at the top of the hour.'
      : `Giphy answered ${response.status}.`,
  )
  process.exit(1)
}

const body = await response.json()
const tiles = (body.data ?? []).map(tileFrom).filter(Boolean)

if (tiles.length === 0) {
  console.error('Giphy returned nothing usable. The catalog is unchanged.')
  process.exit(1)
}

const header = `import type { WallTile } from './wall'

/**
 * The landing wall's GIFs, committed rather than fetched.
 *
 * **Generated. Run \`node scripts/import-wall-gifs.mjs\` to refresh.**
 *
 * These are hot-linked \`media.giphy.com\` renditions — the sanctioned way to
 * display Giphy media, and the same thing \`backdrop.ts\` and \`notFound.ts\`
 * already do. What it is *not* is an API call: the wall renders on four routes
 * (\`/\`, \`/host\`, \`/join\`, \`/join/[code]\`), and searching Giphy from any of
 * them would have cost an upstream call per visitor against an allowance of a
 * hundred an hour — the landing page would have spent the room's whole budget
 * on people who never joined a room. See ADR-0020.
 *
 * Empty is a valid state: \`wallTiles()\` falls back to the offline shelf, which
 * is what a fresh clone with no key and the Playwright suite both get.
 */
export const WALL_GIFS: readonly WallTile[] = ${JSON.stringify(tiles, null, 2)}
`

await writeFile(OUT, header, 'utf8')
console.log(`Wrote ${tiles.length} tiles to lib/gifs/wall.catalog.ts`)
console.log('Curate them: keep what suits the page, swap the rest by hand.')
