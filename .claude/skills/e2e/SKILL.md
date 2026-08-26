---
name: e2e
description: Drive a real browser against the app — run Playwright specs, explore interactively, or capture screenshots at mobile and desktop. Use to verify a feature end-to-end, reproduce a UI bug, or produce a screen grab to share.
---

# Real-browser E2E

Playwright drives actual Chromium against the actual dev server. Use it to
*see* what the app does rather than reason about the markup.

## Environment constraints — read before touching config

- **Never run `playwright install`.** The browser cache is provisioned at
  `PLAYWRIGHT_BROWSERS_PATH` and holds `chromium-1194`.
- **`@playwright/test` is pinned to exactly 1.56.1**, no caret. The package is
  coupled to an exact browser build; a bump looks for a build that isn't there
  and fails at launch, not at install. See
  `docs/adr/0002-pin-playwright-to-browser-build.md`.
- **Chromium only.** No WebKit, no Firefox. The `mobile` project is Chromium
  emulating a Pixel 5 — it is not Mobile Safari, so it won't catch Safari
  quirks. Handle those defensively in CSS instead (`100dvh` over `100vh`).
- **`--no-sandbox`** is already set; the container runs as root.
- `webServer` starts `npm run dev` and reuses a running one, so never
  hand-manage a dev server.

## Running

| Command | For |
| --- | --- |
| `npm run test:e2e` | Both projects. The gate. |
| `npm run test:e2e:mobile` | Fast loop while iterating on phone layout |
| `npx playwright test -g "name"` | One spec |
| `npm run test:e2e:ui` | Interactive explorer — local only, needs a display |
| `npm run test:e2e:report` | Open the last HTML report |

Failures write a screenshot, a video, and an `error-context.md` under
`test-results/`. Read those before guessing at a cause.

## Writing specs

Live in `e2e/`, typed by `e2e/tsconfig.json` (which overrides the root
`exclude`, since the root tsconfig excludes `e2e/` from app typechecking).

**Selector policy, in order:**
1. `getByRole` — how a user and a screen reader find it
2. `getByTestId` — when there's no meaningful role, e.g. a code display
3. CSS — last resort, and **never** a `.module.scss` class name: those are
   hashed and change every build

Watch for strict-mode collisions. `getByText` matches an SVG `<title>` too —
that is a real bug this suite already hit. Scope to a testid when text appears
in more than one place.

**Every feature spec should cover:** the happy path, keyboard reachability of
anything interactive, and no horizontal overflow at mobile width.

## Screenshots to share

For a design review or when an Artifact can't be published:

```ts
const shot = await page.screenshot({ fullPage: true })
await testInfo.attach(`name-${testInfo.project.name}`, {
  body: shot, contentType: 'image/png',
})
```

Because the suite runs both projects, that gives you mobile and desktop from
one spec. Send them to the user with `SendUserFile` — don't just say where they
landed.

For an ad-hoc grab outside the suite, write a short script that imports
`@playwright/test` and **run it from the repo root** so Node resolves the
package. Launch with `args: ['--no-sandbox', '--disable-dev-shm-usage']`.
