import 'server-only'

import {
  RELEASE_LIMIT,
  REPO_SLUG,
  toSafeHtml,
  type Release,
  type ReleaseFeed,
} from './releases'

/**
 * How long a release list is worth. An hour.
 *
 * This is the whole rate-limit story: the fetch is cached by the framework, so
 * it runs once an hour *per deployment* rather than once per visitor.
 * Unauthenticated GitHub allows 60 requests an hour per IP and this spends 24
 * a day.
 */
const REVALIDATE_SECONDS = 3_600

/**
 * A fixed changelog for the suite, shaped like the real payload.
 *
 * Carries the two things worth asserting: a **relative** link, which is what
 * GitHub actually sends and what `toSafeHtml` exists to fix, and the block
 * markup that forced `Modal`'s `bodyBlock` prop.
 */
const STUB_RELEASES: readonly Release[] = [
  {
    tag: 'v9.9.9',
    name: 'v9.9.9',
    publishedAt: '2026-09-21T16:03:24Z',
    /*
      Deliberately longer than the card.

      The bug this fixture has to reproduce is a body that overflows: the card
      used to be the scroller, so a long release pushed the foot — the dots,
      Back and Next — below the fold and out of reach. A three-line stub would
      fit, pass, and prove nothing.
    */
    html: toSafeHtml(
      '<p>A stub release, so the suite asks nobody anything.</p>' +
        '<h2>What it does</h2><ul><li>Holds still</li><li>Says the same thing twice</li></ul>' +
        '<h2>Why it is long</h2>' +
        '<p>Because the card is six hundred pixels tall and the thing worth ' +
        'testing is what happens when the notes are not. A release that fits ' +
        'exercises none of the layout this fixture exists for.</p>' +
        '<p>So it keeps going. The body is the scroller, the head stays where ' +
        'it is, and the pair of controls at the foot stays reachable however ' +
        'much somebody wrote about a patch release.</p>' +
        '<h2>And once more</h2>' +
        '<ul><li>The dots stay visible</li><li>Back stays visible</li>' +
        '<li>The last line does not sit flush against either of them</li></ul>' +
        '<p>See <a href="/Jmeza081/captionist/blob/main/docs/backlog.md">the backlog</a>.</p>',
    ),
    url: 'https://github.com/Jmeza081/captionist/releases/tag/v9.9.9',
  },
  {
    tag: 'v9.9.8',
    name: 'v9.9.8',
    publishedAt: '2026-09-14T09:00:00Z',
    html: toSafeHtml('<p>An older stub, so Back and Next have somewhere to go.</p>'),
    url: 'https://github.com/Jmeza081/captionist/releases/tag/v9.9.8',
  },
]

interface GitHubRelease {
  tag_name?: unknown
  name?: unknown
  published_at?: unknown
  body_html?: unknown
  html_url?: unknown
  draft?: unknown
  prerelease?: unknown
}

/** Narrowed by hand: `unknown` in, a `Release` or nothing out. No `any`. */
function toRelease(raw: GitHubRelease): Release | undefined {
  const tag = typeof raw.tag_name === 'string' ? raw.tag_name : undefined
  const publishedAt = typeof raw.published_at === 'string' ? raw.published_at : undefined
  const url = typeof raw.html_url === 'string' ? raw.html_url : undefined
  if (!tag || !publishedAt || !url) return undefined
  // A draft has no business on a public page, and GitHub only returns them to
  // an authenticated caller anyway — belt and braces.
  if (raw.draft === true) return undefined

  const name = typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : tag
  const html = typeof raw.body_html === 'string' ? toSafeHtml(raw.body_html) : ''
  return { tag, name, publishedAt, html, url }
}

/**
 * The repository's releases, newest first.
 *
 * Server-only, and called from the page rather than from a route handler of
 * ours: a handler would add a serverless surface to a static page in order to
 * proxy data that changes about weekly.
 *
 * `body_html` needs the `html+json` media type — the default `Accept` returns
 * Markdown in `body` and nothing rendered, which is what would otherwise force
 * a Markdown dependency into the bundle for four sentences of text.
 */
export async function fetchReleases(): Promise<ReleaseFeed> {
  // The suite talks to no third party, and this is the switch that keeps that
  // true of the front door — the same shape as `ABLY_STUB` and
  // `NEXT_PUBLIC_GIFS_STUB`, and stated in `playwright.config.ts` rather than
  // inherited from this machine happening to be offline. Without it a full run
  // spends a GitHub request per page load and the changelog assertions pass or
  // fail on what was released that day.
  if (process.env.RELEASES_STUB) return { status: 'ok', releases: STUB_RELEASES }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_SLUG}/releases?per_page=${RELEASE_LIMIT}`,
      {
        headers: {
          Accept: 'application/vnd.github.html+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        next: { revalidate: REVALIDATE_SECONDS },
      },
    )

    // 403 and 429 both mean the quota, and they are the one failure worth
    // telling apart: "try again in a minute" is wrong advice for an hourly
    // window.
    if (response.status === 403 || response.status === 429) return { status: 'rate-limited' }
    if (!response.ok) return { status: 'unavailable' }

    const payload: unknown = await response.json()
    if (!Array.isArray(payload)) return { status: 'unavailable' }

    const releases = payload
      .map((item) => toRelease(item as GitHubRelease))
      .filter((item): item is Release => item !== undefined)

    return { status: 'ok', releases }
  } catch {
    // A network error on a page that is otherwise entirely static. The landing
    // page still has to render, so this can never throw.
    return { status: 'unavailable' }
  }
}
