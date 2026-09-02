/**
 * Builds `design-review/index.html` from whatever the sweep shot.
 *
 * Reads the directory rather than a manifest: the spec decides what it
 * captures, and a second source of truth would go stale the first time a
 * phase is added to it.
 *
 *   node scripts/contact-sheet.mjs
 */
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'design-review')

/** `05-waiting-straggler-guest-mobile[-full].png` → its parts. */
function parse(file) {
  const parts = file.replace(/\.png$/, '').split('-')
  const full = parts.at(-1) === 'full'
  if (full) parts.pop()
  const viewport = parts.pop()
  // The front door has no seat, so what is left after the order is the screen.
  const role = ['host', 'guest'].includes(parts.at(-1)) ? parts.pop() : null
  const order = parts.shift()
  return { order, screen: parts.join(' '), role, viewport, full, file }
}

const groups = []
for (const group of (await readdir(ROOT, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()) {
  const shots = (await readdir(path.join(ROOT, group)))
    .filter((f) => f.endsWith('.png'))
    .map(parse)
  const screens = new Map()
  const fulls = new Map()
  for (const shot of shots) {
    if (shot.full) fulls.set(`${shot.order}|${shot.role}|${shot.viewport}`, shot.file)
  }
  for (const shot of shots.filter((s) => !s.full).sort((a, b) => a.file.localeCompare(b.file))) {
    const key = `${shot.order} ${shot.screen}`
    if (!screens.has(key)) screens.set(key, [])
    screens.get(key).push({
      ...shot,
      fullFile: fulls.get(`${shot.order}|${shot.role}|${shot.viewport}`) ?? null,
    })
  }
  groups.push({ group, screens })
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const body = groups
  .map(
    ({ group, screens }) => `<section>
  <h2 id="${esc(group)}">${esc(group)}</h2>
  ${[...screens]
    .map(
      ([key, shots]) => `<article>
    <h3>${esc(key)}</h3>
    <div class="row">
      ${shots
        .map(
          (s) => `<figure class="${s.viewport}">
        <a href="${group}/${s.file}" target="_blank"><img loading="lazy" src="${group}/${s.file}" alt="${esc(key)} ${s.role ?? ''} ${s.viewport}"></a>
        <figcaption>${s.role ? esc(s.role) + ' · ' : ''}${esc(s.viewport)}${
            s.fullFile ? ` · <a href="${group}/${s.fullFile}" target="_blank">full page</a>` : ''
          }</figcaption>
      </figure>`,
        )
        .join('\n      ')}
    </div>
  </article>`,
    )
    .join('\n  ')}
</section>`,
  )
  .join('\n')

const nav = groups.map((g) => `<a href="#${esc(g.group)}">${esc(g.group)}</a>`).join('')
const total = groups.reduce(
  (n, g) => n + [...g.screens.values()].reduce((m, s) => m + s.length, 0),
  0,
)

await writeFile(
  path.join(ROOT, 'index.html'),
  `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Captionist — design review</title>
<style>
  :root { color-scheme: light dark; --ink: #16161a; --dim: #6b6b76; --line: #e2e2e8; --bg: #fafafa; --card: #fff; }
  @media (prefers-color-scheme: dark) {
    :root { --ink: #f0f0f4; --dim: #9a9aa6; --line: #2a2a32; --bg: #101014; --card: #17171d; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  header { position: sticky; top: 0; z-index: 2; padding: 20px 26px 14px;
           background: var(--bg); border-bottom: 1px solid var(--line); }
  h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: -0.01em; }
  .meta { color: var(--dim); }
  nav { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
  nav a { padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px;
          color: var(--ink); text-decoration: none; background: var(--card); }
  main { padding: 26px; }
  h2 { margin: 34px 0 6px; font-size: 15px; text-transform: uppercase;
       letter-spacing: 0.08em; color: var(--dim); }
  article { border-top: 1px solid var(--line); padding: 18px 0; }
  h3 { margin: 0 0 12px; font-size: 15px; font-variant-numeric: tabular-nums; }
  .row { display: flex; gap: 18px; align-items: flex-start; overflow-x: auto; padding-bottom: 6px; }
  figure { margin: 0; flex: 0 0 auto; }
  figure.mobile img { width: 240px; }
  figure.desktop img { width: 520px; }
  img { display: block; border: 1px solid var(--line); border-radius: 8px;
        background: var(--card); height: auto; }
  figcaption { margin-top: 6px; color: var(--dim); }
</style>
<header>
  <h1>Captionist — design review</h1>
  <div class="meta">${total} screens · caption and react, host and guest, mobile (Pixel 5) and desktop (1440×900) · each tile is the viewport a player sees; “full page” is the whole document</div>
  <nav>${nav}</nav>
</header>
<main>
${body}
</main>
`,
)

console.log(`design-review/index.html — ${total} shots across ${groups.length} groups`)
