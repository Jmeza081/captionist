/**
 * One reaction, as both the picker and the room understand it.
 *
 * Declared here rather than in `ReactionToolbar` because the dependency only
 * runs one way: `lib/` holds state and `components/` is UI, so a type owned by
 * a molecule and imported by the pure core would point the arrow backwards —
 * erased at build, and still the wrong shape to leave in the tree.
 */
export interface Reaction {
  id: string
  /** The emoji character, or a URL for an image tile. */
  glyph: string
  /** `image` renders the glyph as an `<img>` rather than text. */
  kind?: 'emoji' | 'image'
  /** Search terms. The design matches on keywords, not just the character. */
  keywords: string[]
  label: string
  /** Which tab in the picker this belongs under. */
  pack: ReactionPack
}

/**
 * The picker's tabs, from Screens 2b.
 *
 * Required on every reaction rather than optional: a tile with no pack would
 * appear under no tab, which is a hole nobody would notice. Make the compiler
 * ask instead.
 */
export type ReactionPack = 'slackmojis' | 'smileys' | 'objects'

/**
 * The room's reaction set.
 *
 * One list, read by the picker, the composer's one-tap row, the reveal bar and
 * the component gallery.
 *
 * **The order is load-bearing, and three rules pin it.** Positions 1–6 are
 * emoji, because `QUICK_REACTIONS` and `REVEAL_REACTIONS` slice off the front
 * and neither the composer's one-tap row nor the reveal bar should become
 * image tiles. Positions 7–10 are the four Slackmojis, so the picker's
 * unsearched grid — `slice(0, DEFAULT_COUNT)` — is "6 emoji + 4 Slackmoji
 * GIFs", which is DESIGNSYSTEM.md §4.4 verbatim. Everything after is search
 * and tab territory. `lib/reactions.test.ts` asserts all three rather than
 * trusting this paragraph.
 *
 * **On the Slackmojis.** Phase 6 left these out on the grounds that "Slackmoji
 * are a workspace's own uploads and this app has no storage target". That
 * blocker is about *user uploads* — it is the uploader's reason, not this
 * one's. The app already shipped 24 authored SVGs under `public/media/`, and the
 * design's own 2b names `:shipit:` and `:works-on-my-machine:` under a
 * "SHIPS WITH CAPTIONIST" heading. So these four are ours, drawn here, and the
 * one honest deviation left is that they are SVG rather than animated GIF —
 * the same deviation `stub-*.svg` already makes.
 */
export const REACTIONS: readonly Reaction[] = [
  // 1–6: the one-tap row and the reveal bar. Emoji, always.
  { id: 'fire', glyph: '🔥', keywords: ['fire', 'hot', 'burn', 'heat'], label: 'Fire', pack: 'objects' },
  { id: 'skull', glyph: '💀', keywords: ['skull', 'dead', 'rip', 'killed'], label: 'Skull', pack: 'smileys' },
  { id: 'cry-laugh', glyph: '😂', keywords: ['laugh', 'cry', 'funny', 'lol'], label: 'Crying with laughter', pack: 'smileys' },
  { id: 'eyes', glyph: '👀', keywords: ['eyes', 'look', 'watching', 'suspicious'], label: 'Eyes', pack: 'smileys' },
  { id: 'melting', glyph: '🫠', keywords: ['melt', 'melting', 'fine', 'this is fine'], label: 'Melting', pack: 'smileys' },
  { id: 'target', glyph: '🎯', keywords: ['target', 'exact', 'bullseye', 'accurate'], label: 'Direct hit', pack: 'objects' },

  // 7–10: the Slackmojis, so the default grid is 6 + 4.
  {
    id: 'shipit',
    glyph: '/media/slackmoji-shipit.svg',
    kind: 'image',
    keywords: ['shipit', 'squirrel', 'ship', 'deploy', 'send', 'yolo'],
    // Not "Ship it": 🚢 already owns that label, and two reactions with one
    // accessible name breaks `labelFor` and the picker's tile names alike.
    label: 'Shipit squirrel',
    pack: 'slackmojis',
  },
  {
    id: 'works-on-my-machine',
    glyph: '/media/slackmoji-works-on-my-machine.svg',
    kind: 'image',
    keywords: ['works', 'machine', 'mine', 'local', 'worksforme', 'laptop'],
    label: 'Works on my machine',
    pack: 'slackmojis',
  },
  {
    id: 'lgtm',
    glyph: '/media/slackmoji-lgtm.svg',
    kind: 'image',
    keywords: ['lgtm', 'approve', 'looks', 'good', 'review', 'ship'],
    label: 'LGTM',
    pack: 'slackmojis',
  },
  {
    id: 'this-is-fine',
    glyph: '/media/slackmoji-this-is-fine.svg',
    kind: 'image',
    keywords: ['fine', 'burning', 'calm', 'disaster', 'outage'],
    label: 'This is fine',
    pack: 'slackmojis',
  },

  // The rest: reachable by search, and by their tab.
  { id: 'clap', glyph: '👏', keywords: ['clap', 'applause', 'well played'], label: 'Applause', pack: 'smileys' },
  { id: 'ship', glyph: '🚢', keywords: ['ship', 'deploy', 'release', 'friday'], label: 'Ship it', pack: 'objects' },
  { id: 'siren', glyph: '🚨', keywords: ['panic', 'outage', 'incident', 'oncall'], label: 'Incident', pack: 'objects' },
  { id: 'grimace', glyph: '😬', keywords: ['yikes', 'oof', 'awkward', 'grimace'], label: 'Yikes', pack: 'smileys' },

  { id: 'clown', glyph: '🤡', keywords: ['clown', 'me', 'foolish', 'my bad'], label: 'Clown', pack: 'smileys' },
  { id: 'sob', glyph: '😭', keywords: ['sob', 'crying', 'pain', 'friday'], label: 'Sobbing', pack: 'smileys' },
  { id: 'upside-down', glyph: '🙃', keywords: ['upside', 'down', 'great', 'cope'], label: 'Upside down', pack: 'smileys' },
  { id: 'salute', glyph: '🫡', keywords: ['salute', 'oncall', 'godspeed', 'respect'], label: 'Salute', pack: 'smileys' },
  { id: 'handshake', glyph: '🤝', keywords: ['handshake', 'deal', 'agreed', 'merged'], label: 'Handshake', pack: 'smileys' },
  { id: 'see-no-evil', glyph: '🙈', keywords: ['hide', 'cannot look', 'monkey', 'legacy'], label: 'See no evil', pack: 'smileys' },
  { id: 'sleeping', glyph: '😴', keywords: ['sleep', 'standup', 'bored', 'retro'], label: 'Asleep', pack: 'smileys' },
  { id: 'brain', glyph: '🧠', keywords: ['brain', 'galaxy', 'clever', 'big brain'], label: 'Big brain', pack: 'smileys' },

  { id: 'hundred', glyph: '💯', keywords: ['hundred', 'perfect', 'agreed', 'exactly'], label: 'A hundred percent', pack: 'objects' },
  { id: 'rocket', glyph: '🚀', keywords: ['rocket', 'launch', 'fast', 'shipped'], label: 'Rocket', pack: 'objects' },
  { id: 'coffee', glyph: '☕', keywords: ['coffee', 'standup', 'monday', 'morning'], label: 'Coffee', pack: 'objects' },
  { id: 'bug', glyph: '🐛', keywords: ['bug', 'defect', 'issue', 'regression'], label: 'Bug', pack: 'objects' },
  { id: 'bandage', glyph: '🩹', keywords: ['bandage', 'patch', 'hotfix', 'duct tape'], label: 'Hotfix', pack: 'objects' },
  { id: 'chart-down', glyph: '📉', keywords: ['chart', 'down', 'metrics', 'regression'], label: 'Down and to the right', pack: 'objects' },
  { id: 'extinguisher', glyph: '🧯', keywords: ['extinguisher', 'firefight', 'incident', 'rollback'], label: 'Fire extinguisher', pack: 'objects' },
  { id: 'alarm', glyph: '⏰', keywords: ['alarm', 'clock', 'page', 'three am'], label: 'Alarm', pack: 'objects' },
  { id: 'pizza', glyph: '🍕', keywords: ['pizza', 'launch night', 'crunch', 'food'], label: 'Pizza', pack: 'objects' },
  { id: 'trash', glyph: '🗑️', keywords: ['trash', 'delete', 'revert', 'bin'], label: 'Bin it', pack: 'objects' },
]

/**
 * The one-tap row in the composer, and the five on the reveal screen.
 *
 * Taken from the head of the same list rather than typed out again, so adding
 * a reaction in one place cannot silently fail to appear in the other. The
 * ordering rule above is what keeps these six emoji rather than images: a row
 * of one-tap keys is characters, not pictures.
 */
export const QUICK_REACTIONS = REACTIONS.slice(0, 6)

/** Five is the cap `RevealReactionBar` sets, so the row fits a 440px column. */
export const REVEAL_REACTIONS: readonly { id: string; glyph: string; label: string }[] =
  REACTIONS.slice(0, 5).map(({ id, glyph, label }) => ({ id, glyph, label }))

/** The emoji a reaction id stands for, for anything that carries only the id. */
export function glyphFor(id: string): string {
  return REACTIONS.find((r) => r.id === id)?.glyph ?? id
}

/**
 * The id an emoji belongs to.
 *
 * The wire carries the glyph, because that is what a tally has to render and
 * an unknown id would render as nothing. The pickers key their pressed state
 * on the id, so this is the one hop between the two.
 */
export function idFor(glyph: string): string {
  return REACTIONS.find((r) => r.glyph === glyph)?.id ?? glyph
}

/**
 * What a screen reader calls it.
 *
 * An unknown glyph falls back to the glyph itself, which reads fine for an
 * emoji and terribly for a URL — so a location-shaped glyph gets a generic
 * name rather than having its path read out character by character.
 */
export function labelFor(glyph: string): string {
  const known = REACTIONS.find((r) => r.glyph === glyph)
  if (known) return known.label
  return isImageGlyph(glyph) ? 'A reaction' : glyph
}

/** Whether a glyph is a picture rather than a character. */
export function isImageGlyph(glyph: string): boolean {
  return glyph.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(glyph)
}
