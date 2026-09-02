/**
 * What the gallery holds, and where.
 *
 * One table, because three things need the same list and any two of them
 * written separately would drift: the tab bar, the jump rail beside each panel,
 * and the deep link — `/components#media` has to know which tab owns `media`
 * before that tab renders. The panels below carry the cases; this carries the
 * order, the titles and the tier each one belongs to.
 *
 * **The tier is the organising idea, because it is a rule the repo enforces.**
 * `components/README.md` decides a component's tier by what it depends on, so a
 * tab that says "molecules" is making the same claim the directory does — and
 * a case in the wrong tab is a case in the wrong folder.
 */

export const TABS = [
  {
    id: 'atoms',
    label: 'Atoms',
    blurb: 'Markup, tokens and their own props. Nothing from this repo but `Icon`.',
  },
  {
    id: 'molecules',
    label: 'Molecules',
    blurb: 'Atoms composed into something with a job. Local state, no room state.',
  },
  {
    id: 'organisms',
    label: 'Organisms',
    blurb: 'Room state, data or routing — mostly whole screens, which live in the room.',
  },
  {
    id: 'assets',
    label: 'Assets',
    blurb: 'The art that ships: faces, hats, reactions, and the shelf we fall back to.',
  },
  {
    id: 'tokens',
    label: 'Tokens',
    blurb: 'The scale everything is measured on, read from the CSS custom properties.',
  },
] as const

export type TabId = (typeof TABS)[number]['id']

export function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

interface SectionMeta {
  tab: TabId
  title: string
  /** The right-aligned note in the section head — the spec, in a few words. */
  spec: string
}

/**
 * Declaration order is render order, and the rail's order.
 *
 * The ids are a public surface: `e2e/components.spec.ts` deep-links three of
 * them, and a renamed id is a broken link rather than a missing section.
 */
export const SECTIONS = {
  /* ---------------- Atoms ---------------- */
  buttons: { tab: 'atoms', title: 'Button', spec: '5 variants · 3 sizes · blocked' },
  segmented: {
    tab: 'atoms',
    title: 'Segmented control',
    spec: 'track · active pill · icons',
  },
  fields: { tab: 'atoms', title: 'Text field', spec: '62 / 52 / 46 / 34px' },
  settings: { tab: 'atoms', title: 'Toggle & stepper', spec: '44×24 · 36/88×44' },
  status: {
    tab: 'atoms',
    title: 'Status & labels',
    spec: 'timer · tags · chips · tallies',
  },
  avatars: { tab: 'atoms', title: 'Avatar', spec: '8 sizes · hats from 34px up' },
  'tv-static': {
    tab: 'atoms',
    title: 'TV static',
    spec: 'the placeholder for media still being fetched',
  },

  /* ---------------- Molecules ---------------- */
  players: { tab: 'molecules', title: 'Player rows', spec: 'roster · tracker · standing' },
  pickers: {
    tab: 'molecules',
    title: 'Pickers & mode cards',
    spec: 'a face to play as, a format to play',
  },
  media: { tab: 'molecules', title: 'Media card', spec: '6 states · both modes' },
  'tuned-image': {
    tab: 'molecules',
    title: 'Tuned image',
    spec: 'a set behind every remote picture, gone the moment it lands',
  },
  prompt: {
    tab: 'molecules',
    title: 'Prompt banner',
    spec: 'react mode · always full width',
  },
  chat: { tab: 'molecules', title: 'Chat', spec: 'message · announcement · unread' },
  chrome: { tab: 'molecules', title: 'App header', spec: '72px · phase · settings line' },
  entry: { tab: 'molecules', title: 'Code entry & share', spec: 'C- prefix · 6 chars' },
  podium: { tab: 'molecules', title: 'Podium', spec: 'winner centre · 1-2-3 in the DOM' },
  composer: {
    tab: 'molecules',
    title: 'Composer & GIF panel',
    spec: 'send on text or attachment',
  },
  reveal: {
    tab: 'molecules',
    title: 'Reveal reaction bar',
    spec: '5 one-tap · then the toolbar',
  },
  overlays: { tab: 'molecules', title: 'Overlays', spec: 'opener · modal · toolbox · rail' },

  /* ---------------- Organisms ---------------- */
  boot: { tab: 'organisms', title: 'Room boot', spec: 'host · guest · refused' },
  screens: {
    tab: 'organisms',
    title: 'The screens',
    spec: 'played, not previewed',
  },

  /* ---------------- Assets ---------------- */
  faces: { tab: 'assets', title: 'Faces', spec: '70 seeds · rendered in the browser' },
  hats: { tab: 'assets', title: 'Hats', spec: '16 to pick from, and one you earn' },
  reactions: {
    tab: 'assets',
    title: 'Reactions',
    spec: 'the defaults, the packs, and 4 of our own',
  },
  shelf: {
    tab: 'assets',
    title: 'The offline shelf',
    spec: 'what the picker shows with no provider',
  },
  mark: { tab: 'assets', title: 'The mark', spec: 'logo · wordmark' },
  'gif-usage': {
    tab: 'assets',
    title: 'GIF allowance',
    spec: 'counted locally · for the production-key application',
  },

  /* ---------------- Tokens ---------------- */
  spacing: { tab: 'tokens', title: 'Spacing', spec: 'not a 4px grid, on purpose' },
  radii: { tab: 'tokens', title: 'Radii', spec: 'named for the surface, not the number' },
  metrics: { tab: 'tokens', title: 'Reach & rails', spec: 'the sizes a finger needs' },
} as const satisfies Record<string, SectionMeta>

export type SectionId = keyof typeof SECTIONS

const IDS = Object.keys(SECTIONS) as SectionId[]

/** The sections a tab holds, in declaration order. */
export function sectionsIn(tab: TabId): readonly SectionId[] {
  return IDS.filter((id) => SECTIONS[id].tab === tab)
}

/** Which tab owns a deep link — `#media` opens Molecules. */
export function tabFor(hash: string): TabId | undefined {
  if (isTabId(hash)) return hash
  return (IDS as string[]).includes(hash) ? SECTIONS[hash as SectionId].tab : undefined
}
