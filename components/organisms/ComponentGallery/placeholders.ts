/**
 * Stand-in artwork for the gallery.
 *
 * The real room uses the GIF provider's art and the design's avatar sprites, neither of
 * which is in the repo. These are inline SVG data URIs so the gallery renders
 * identically offline and in CI — no network, no missing-image boxes, and
 * nothing to keep in sync with an asset pipeline that doesn't exist yet.
 */

function svg(body: string, w = 320, h = 200): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(doc)}`
}

function frame(from: string, to: string, glyph: string, w = 320, h = 200) {
  return svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
     </linearGradient></defs>
     <rect width="${w}" height="${h}" fill="url(#g)"/>
     <text x="50%" y="50%" font-size="${Math.round(h / 2.6)}" text-anchor="middle"
       dominant-baseline="central">${glyph}</text>`,
    w,
    h,
  )
}

export const MEDIA = {
  serverRack: frame('#2A1B4D', '#0E0F10', '🔥'),
  standup: frame('#1B3A4D', '#0E0F10', '💀'),
  deploy: frame('#4D2B1B', '#0E0F10', '🚀'),
  oncall: frame('#1B4D2E', '#0E0F10', '😐'),
  retro: frame('#4D1B3A', '#0E0F10', '🫠'),
  outage: frame('#4D4A1B', '#0E0F10', '🙃'),
  // Two shapes outside the band, so the gallery shows what the clamp does to
  // them rather than only describing it. See `mediaAspect` in `lib/media.ts`.
  wide: frame('#1B3A4D', '#0E0F10', '🫠', 640, 360),
  tall: frame('#2A1B4D', '#0E0F10', '👀', 360, 640),
}

export const ATTACHMENT = frame('#1B3A4D', '#0E0F10', '👀', 180, 120)

/**
 * A picture that never arrives.
 *
 * Deliberately a path the dev server answers with a 404 rather than a broken
 * data URI: it is the real failure — a GIF the provider has pulled, a CDN that
 * does not answer — and it is what holds `TunedImage`'s static on screen long
 * enough to look at. Everything else in this file loads instantly by design.
 */
export const DEAD_CHANNEL = '/media/a-channel-that-never-came.gif'

/**
 * Slackmoji stand-ins. Rendered at 22px in the toolbar, so the glyph is sized
 * to fill its box rather than derived from the frame height like the media
 * placeholders — at 44/2.6 it vanished.
 */
function moji(glyph: string, from: string, to: string): string {
  return svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
     </linearGradient></defs>
     <rect width="44" height="44" rx="8" fill="url(#g)"/>
     <text x="50%" y="52%" font-size="30" text-anchor="middle"
       dominant-baseline="central">${glyph}</text>`,
    44,
    44,
  )
}

export const SLACKMOJI = {
  ship: moji('🚢', '#1B3A4D', '#2A5B7D'),
  panic: moji('🚨', '#4D1B1B', '#7D2A2A'),
  yikes: moji('😬', '#4D3A1B', '#7D5B2A'),
  nice: moji('🤌', '#2A1B4D', '#4A3B7D'),
}

/** The player colours the design uses for avatar fills. */
export const PLAYER_COLORS = {
  red: '#FF787D',
  yellow: '#F6E338',
  purple: '#9B7BFF',
  turquoise: '#86E6F9',
  olive: '#B4C36A',
  amber: '#FFC24B',
  green: '#83D06C',
} as const
