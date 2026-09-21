# 0042 — The changelog is GitHub's HTML, rendered as it arrives

**Status:** accepted · 2026-09-21

## Context

The landing page shows the repository's release notes. GitHub stores them as
Markdown, and this app has never had a Markdown renderer — so the obvious
reading is "add one". `react-markdown` plus a sanitiser is roughly 40kB of
JavaScript, shipped to every visitor of a page whose entire job is to get
somebody into a room, in order to format about four sentences that change
roughly weekly.

There is a second option the REST documentation makes easy to miss. Asking for
`Accept: application/vnd.github.html+json` returns `body_html` alongside
`body` — GitHub's own rendered output, the same HTML that appears on
github.com, sanitised on their side. Verified against this repository's
`v0.1.0`: the payload contains `a`, `code`, `h2`, `li`, `p`, `strong` and `ul`,
no `script`, and no event-handler attributes.

Taking it means putting somebody else's HTML on our origin, which is a decision
rather than a shortcut.

## Decision

**Render `body_html` directly, with `dangerouslySetInnerHTML`, and add no
Markdown dependency and no sanitiser of our own.**

The trust boundary is the argument. Writing a release note requires push access
to the repository, and push access already means putting arbitrary code into
this application. A regex sanitiser layered on top would not add a second
boundary; it would add the *appearance* of one, which is worse than none
because it invites the next reader to trust it.

Two things are done to the HTML before it renders, in `toSafeHtml`:

- **Links are absolutised.** GitHub emits them relative —
  `href="/Jmeza081/captionist/blob/…"` — which resolves against
  `captionist.fun` and 404s. This is a real bug that shipped-and-was-caught
  rather than a hypothetical one.
- **Every link is given `target="_blank"` and `rel="noreferrer noopener"`**,
  matching every other outbound link in the app.

Three supporting decisions came with it:

- **The fetch is the page's, not a route handler's.** `app/page.tsx` fetches
  with `revalidate: 3600`, so it runs once an hour per deployment rather than
  once per visitor — which is what keeps a page with no API key clear of the
  60-per-hour anonymous limit. `/` stays statically prerendered with an ISR
  window. A route handler would have added a serverless surface to a static
  page in order to proxy data that changes weekly.
- **The module is split in two.** `lib/releases.ts` holds the types and the
  pure helpers and is client-safe; `lib/releases.server.ts` carries
  `server-only` and the fetch. A client component importing a *value* — not
  merely a type — from a `server-only` module is a build error, and the modal
  that renders this is a client component.
- **`RELEASES_STUB` joins `ABLY_STUB` and `NEXT_PUBLIC_GIFS_STUB`.** The fetch
  is server-side, so `--host-resolver-rules` — which blocks the *browser's*
  DNS — does not cover it, and `page.route` cannot intercept a call the
  browser never makes. Without the switch, the suite would call GitHub once per
  landing-page load and its changelog assertions would depend on what shipped
  that day.

## Consequences

- **The notes are styled by us and written by GitHub.** `WhatsNewModal`'s
  stylesheet targets the tag set above by descendant selector, because the
  markup carries none of our classes. A release note using a tag outside that
  set — a table, an image — will render unstyled rather than broken. That is
  the acceptable failure, and the reason the set is written down here.
- **If the repository ever takes outside contributors with push access, revisit
  this.** The decision rests entirely on "author of a release note" and "author
  of the app" being the same trust level. That is true of a solo public repo
  and stops being true the moment it is not.
- `body_html` is not in the default response, so the media type is load-bearing.
  Dropping it silently returns Markdown in `body` and an empty changelog, not
  an error.
- No new dependency, and the page weight is unchanged.
