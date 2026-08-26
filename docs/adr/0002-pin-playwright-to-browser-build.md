# 0002 — Pin @playwright/test to the provisioned browser build

**Status:** accepted · 2026-08-26

## Context

E2E runs against a Chromium provided by the environment rather than one
downloaded per install: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` holds
`chromium-1194`, and no network path exists to fetch a different build.

Playwright couples its npm package to an exact browser build number. Version
1.56.x expects build 1194; a later minor looks for a build that isn't in the
cache and fails at launch — not at install, so `npm update` would appear to
succeed and E2E would break on the next run with a confusing error.

## Decision

Pin `@playwright/test` to exactly `1.56.1` — no caret. Install with
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, and never run `playwright install` in
this environment.

Chromium is also the only browser present, so the config declares Chromium
projects only. "Mobile" means Chromium emulating a Pixel 5, not WebKit.

## Consequences

- Upgrading Playwright is a deliberate two-step change: bump the package *and*
  provision the matching browser build. It is not a routine dependency bump.
- No WebKit or Firefox coverage. Safari-specific bugs will not be caught here;
  they need a real device or a hosted browser grid.
- Mobile Safari quirks — notably viewport units and the collapsing toolbar —
  are handled defensively in CSS instead (`100dvh` with a `100vh` fallback)
  rather than being caught by a test.
- The constraint is repeated in the `/e2e` skill and in `CLAUDE.md`, so the
  next person to hit a launch failure has the reason to hand.
