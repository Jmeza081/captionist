import styles from './Icon.module.scss'

/**
 * The glyph set the design draws, traced from the component library.
 *
 * These are the design's own paths rather than `@phosphor-icons/react` — the
 * smiley in particular is specific (the reaction affordance is always this
 * face plus a plus, never a bare `+`), and matching stroke weights across a
 * mixed set is harder than carrying nine paths.
 */
export type IconName =
  | 'search'
  | 'upload'
  | 'uploadTray'
  | 'smiley'
  | 'plus'
  | 'send'
  | 'check'
  | 'chevronRight'
  | 'chat'
  | 'close'

interface PathSpec {
  d: string[]
  circles?: { cx: number; cy: number; r: number }[]
  /** The design draws each glyph at its own weight; keep them. */
  width: number
}

const PATHS: Record<IconName, PathSpec> = {
  search: {
    circles: [{ cx: 11, cy: 11, r: 7 }],
    d: ['M16.5 16.5 21 21'],
    width: 2.2,
  },
  upload: {
    d: ['M12 16V4M7.5 8.5 12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16'],
    width: 1.9,
  },
  uploadTray: {
    d: ['M12 15.5V4.5M8 8.5 12 4.5l4 4M4.5 15.5v3A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-3'],
    width: 2.1,
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
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={spec.width}
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
