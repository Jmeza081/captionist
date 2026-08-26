@AGENTS.md

# Captionist

Live captions for a room. A host opens a session; guests join by scanning a QR
code or typing a short room code. Mobile-first — most guests are on a phone,
in a room, while someone is talking.

**Stack:** Next 16 (App Router, Turbopack) · React 19 · TypeScript 5.9 strict ·
Sass modules over `theme/` tokens · Playwright for E2E · Ably v2 (installed,
not yet wired).

This Next version postdates your training data. Read
`node_modules/next/dist/docs/` before writing framework code — do not rely on
recalled APIs.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on `http://127.0.0.1:3000` |
| `npm run verify` | `lint` + `typecheck` + `build` — the gate before any push |
| `npm run test:e2e` | Playwright, mobile + desktop |
| `npm run docs:pack` | Repomix pack (input to `/ship`, gitignored) |

## Non-negotiables

1. **Search before you create.** Check `components/`, `theme/`, and the
   inventory in `docs/design-system.md` first. Reuse it, or add a prop to it.
   A new component needs a stated reason why neither worked.
2. **A variant is a prop, never a copy-pasted sibling component.**
3. **Tokens only.** No raw px/rem/hex for spacing, colour, or radius in a
   `.module.scss`. Every one starts `@use 'theme' as t;`. Missing a value? Add
   it to `theme/` and document it in `docs/design-system.md` first.
4. **Mobile-first.** Write the phone layout unconditionally, then layer wider
   screens with `t.mq()`. Min-width queries only. Above `md`, reflow — don't
   just stretch a max-width.
5. **Server Components by default.** Add `'use client'` only when something
   actually needs interactivity or browser APIs, at the smallest scope.
6. **No `any`, no non-null `!`.** `strict` is on; keep it meaningful.
7. **Copy follows `docs/design-system.md` §4.** Sentence case, verb-first
   buttons, no exclamation marks, errors say what happened and what to do next.
8. **Never run `playwright install`** and never bump `@playwright/test` off
   1.56.1 — it is pinned to the provisioned Chromium build. See
   `docs/adr/0002-pin-playwright-to-browser-build.md`.
9. **`CLAUDE.md` is ours, `AGENTS.md` is Next's.** `next dev` rewrites the
   marked block in `AGENTS.md`. Never put project rules there.
10. **Never commit secrets.** `.env.example` documents the shape; real values
    live in `.env.local`.

## Architecture

One route (`/`), statically prerendered. `app/layout.tsx` owns fonts and global
CSS. Components are tiered atoms → molecules → organisms by *dependency*, not
size; pages compose and hold almost no markup.

Full map, diagrams, and what's deliberately not built yet:
`docs/architecture.md`. Tier rules: `components/README.md`.

## Feature workflow

Any request that adds or changes user-facing behaviour runs `/feature`, which
enforces five phases:

1. **Research** — delegate to the `ux-researcher` agent. No code before the
   brief exists.
2. **Reuse audit** — delegate to `component-scout`. Produces the tier placement
   table.
3. **Design** — publish an Artifact for anything with a visual surface. If
   publishing fails, attach a Playwright screenshot instead.
4. **Build** — design-system rules above.
5. **Verify + ship** — `/e2e`, then `/ship`.

**Escape hatch:** typo fixes, dependency bumps, and one-line bug fixes skip
phases 1 and 3. Say which phases you skipped.

## Definition of done

Do not report a feature complete until all of these hold:

- [ ] `npm run verify` passes
- [ ] `npm run test:e2e` passes on **both** projects, with a spec covering the
      new behaviour
- [ ] New components are in the right tier and appended to the inventory table
      in `docs/design-system.md`
- [ ] Copy was reviewed against `docs/design-system.md` §4
- [ ] Interactive elements are keyboard-reachable with a visible focus ring and
      clear 44px touch targets
- [ ] A design artifact or screenshot was shared for anything visual
- [ ] `/ship` was run, so `docs/architecture.md` reflects the change

## Responding

The audience is product and front-end. Lead with what changed and what it
means; keep the rest short. Show a screenshot or artifact rather than
describing a layout in prose. Skip narration of routine tool steps — report
outcomes, and say plainly when something failed or was skipped.
