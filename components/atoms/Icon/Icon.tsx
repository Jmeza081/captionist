import styles from './Icon.module.scss'

/**
 * The glyph set the design draws, traced from the component library.
 *
 * These are the design's own paths rather than `@phosphor-icons/react` — the
 * smiley in particular is specific (the reaction affordance is always this
 * face plus a plus, never a bare `+`), and matching stroke weights across a
 * mixed set is harder than carrying eleven paths.
 */
export type IconName =
  | 'search'
  | 'smiley'
  | 'plus'
  | 'send'
  | 'check'
  | 'chevronRight'
  | 'chat'
  | 'close'
  | 'help'
  | 'star'
  | 'wifiOff'

interface PathSpec {
  d: string[]
  circles?: { cx: number; cy: number; r: number }[]
  /** The design draws each glyph at its own weight; keep them. */
  width: number
  /**
   * Filled rather than stroked. The star is the only one — the design draws it
   * as a solid shape, so a stroke weight would be meaningless on it.
   */
  filled?: boolean
}

const PATHS: Record<IconName, PathSpec> = {
  search: {
    circles: [{ cx: 11, cy: 11, r: 7 }],
    d: ['M16.5 16.5 21 21'],
    width: 2.2,
  },
  smiley: {
    circles: [{ cx: 11, cy: 12, r: 8.2 }],
    d: ['M8 15s1.2 1.4 3 1.4S14 15 14 15M8.4 9.8v.7M13.6 9.8v.7'],
    width: 2,
  },
  plus: {
    d: ['M12 5v14M5 12h14'],
    width: 3.4,
  },
  send: {
    d: ['M3 11l18-7-7 18-2-9z'],
    width: 2.4,
  },
  check: {
    d: ['M4 12.5 9.5 18 20 6.5'],
    width: 3.2,
  },
  chevronRight: {
    d: ['M9 6l6 6-6 6'],
    width: 2.2,
  },
  chat: {
    d: ['M20 12a8 8 0 0 1-8 8H7l-3 3v-5.5A8 8 0 1 1 20 12z'],
    width: 2.1,
  },
  close: {
    d: ['M6 6l12 12M18 6 6 18'],
    width: 2.2,
  },
  help: {
    circles: [{ cx: 12, cy: 12, r: 9 }],
    d: ['M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.3M12 17.1v.5'],
    width: 2.1,
  },
  // Three arcs, a dot, and the slash through them. Drawn shortest-arc-first so
  // the stroke caps line up as the signal "weakens" toward the top.
  wifiOff: {
    d: ['M2.5 8.5a17 17 0 0 1 19 0M5.5 12.2a12 12 0 0 1 13 0M8.7 15.8a7 7 0 0 1 6.6 0M12 19.3v.5', 'M3 21 21 3'],
    width: 2.1,
  },
  // The design draws this at `viewBox="0 0 24 18"`; re-boxed to the shared
  // 24x24 grid by shifting 3.5 down, so it sizes like every other glyph.
  star: {
    d: ['M2 20.5 0 6.5l6 4 6-7 6 7 6-4-2 14z'],
    width: 0,
    filled: true,
  },
}

export interface IconProps {
  name: IconName
  /** Pixel size. The design uses 10–26 depending on the host component. */
  size?: number
  /**
   * Stroke colour. Defaults to `currentColor`, so an icon inside a button
   * inherits the button's text colour and hover states come free.
   */
  color?: string
  /** Set when the icon is the only content of its control. */
  label?: string
}

/**
 * A stroked glyph, sized and coloured by its host.
 *
 * Decorative by default (`aria-hidden`); pass `label` when the icon carries
 * meaning no adjacent text repeats.
 */
export function Icon({ name, size = 16, color, label }: IconProps) {
  const spec = PATHS[name]

  return (
    <svg
      className={styles.icon}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={spec.filled ? (color ?? 'currentColor') : 'none'}
      stroke={spec.filled ? 'none' : (color ?? 'currentColor')}
      strokeWidth={spec.filled ? undefined : spec.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {spec.circles?.map((c) => (
        <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
      {spec.d.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
