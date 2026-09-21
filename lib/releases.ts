/**
 * The shape of a changelog, and the pure helpers either side of the wire.
 *
 * Deliberately **not** `server-only`, and deliberately not holding the fetch:
 * the modal that renders this is a client component, and a client component
 * importing a value — not just a type — from a `server-only` module is a build
 * error rather than a warning. The fetch lives in `releases.server.ts`; this
 * is what both halves are allowed to share.
 */
/** Where the notes come from, and where "Read them on GitHub" goes. */
export const REPO_SLUG = 'Jmeza081/captionist'
export const RELEASES_URL = `https://github.com/${REPO_SLUG}/releases`

/** How many to carry. The modal is a changelog, not an archive. */
export const RELEASE_LIMIT = 10

export interface Release {
  /** `v0.1.0` — the tag, which is also the id. */
  tag: string
  /** The release's title. Falls back to the tag, which is what GitHub shows. */
  name: string
  /** ISO 8601, formatted at the edge so the server and client agree. */
  publishedAt: string
  /** GitHub's own rendered HTML for the body. See `toSafeHtml`. */
  html: string
  /** This release on GitHub. */
  url: string
}

/**
 * What the page got.
 *
 * Three outcomes rather than an array and a `null`, because the screen says a
 * different true thing for each: nothing shipped yet, GitHub is rate-limiting
 * us, or GitHub could not be reached. "Empty" and "broken" must never render
 * the same sentence.
 */
export type ReleaseFeed =
  | { status: 'ok'; releases: readonly Release[] }
  | { status: 'rate-limited' }
  | { status: 'unavailable' }

/**
 * GitHub's rendered HTML, made safe to place on our own origin.
 *
 * **Why `dangerouslySetInnerHTML` is the right call here, stated once so it is
 * not re-litigated.** `body_html` is the same HTML GitHub renders on
 * github.com, sanitised on their side — the payload for this repo's first
 * release contains `a`, `code`, `h2`, `li`, `p`, `strong` and `ul`, no
 * `script`, and no event-handler attributes. More to the point, the trust
 * boundary is not new: writing a release note requires push access to the
 * repository, and push access already means putting arbitrary code into this
 * app. Hand-rolling a regex sanitiser on top would add the *appearance* of a
 * second boundary without adding one.
 *
 * What this does fix is a real bug rather than a hypothetical one: GitHub
 * emits **relative** links — `href="/Jmeza081/captionist/blob/…"` — which
 * resolve against `captionist.fun` and 404. They are absolutised here, and
 * given the same `target`/`rel` every other outbound link in the app carries.
 */
export function toSafeHtml(bodyHtml: string): string {
  return bodyHtml
    .replaceAll('href="/', 'href="https://github.com/')
    .replaceAll('<a ', '<a target="_blank" rel="noreferrer noopener" ')
}


/** "21 September 2026" — long form, because a changelog is read, not scanned. */
export function releaseDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
