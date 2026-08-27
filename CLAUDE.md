@AGENTS.md

# Captionist

A live meme-caption game for engineering teams. A room of 3–20 players plays 5
rounds; a rotating role holder sets up each round, everyone else competes, the
room ranks its top three, a champion is crowned. Players join by scanning a QR
code or typing a short room code.

**Two modes, one round engine.** `caption` — the Captionist supplies a GIF and
everyone writes captions over it. `react` — the Prompter supplies a text prompt
and everyone answers with a GIF. Everything else is shared. Never fork a shared
screen to add mode behaviour; branch the values.

Round flow: `landing → join|setup → lobby → [round opener] → pick|prompt →
caption|submit → waiting → vote → (tiebreak) → reveal → score → … → podium`

**Stack:** Next 16 (App Router, Turbopack) · React 19 · TypeScript 5.9 strict ·
Sass modules over `theme/` tokens · Playwright for E2E · Ably v2 (installed,
not yet wired).

**Design source of truth:** [`design/`](design/) — `DESIGNSYSTEM.md` plus the
three `.dc.html` files, as delivered. `theme/` copies its values verbatim; if
code and design disagree, the code is the bug. The design's own implementation
notes (inline styles, `<sc-if>` templates, `DCLogic`) describe the prototype,
**not** this app — here it's React, Sass modules and the primitives. See
[`design/README.md`](design/README.md) before working from it.

**Where we stand:** [`docs/roadmap.md`](docs/roadmap.md) — the numbered build
phases 0–6, what each one ships, and which are done. **Read it at the start of
every session, before planning anything.** It is the answer to "where do we
stand" after a context clear, and "phase N" always means its numbering, never
the `/feature` skill's.

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
   `.module.scss`. Every one starts `@use 'theme' as t;`. Missing a value? Check
   the design first — if it isn't there either, add it to `theme/` and document
   it in `docs/design-system.md`.
4. **The spacing scale is not a 4px grid — never round to one.** It is the
   uneven set the design specifies (`2/5/6/8/10/12/14/20/26/34/44/52`), and each
   token is named for its own pixel value. `t.$space-12` is 12px.
5. **Layout is a primitive, not a re-declaration.** Reach for `Stack`, `Inline`,
   `Box` or `Grid` before writing `display: flex` in a `.module.scss`. Spacing
   goes on the container as a prop.
6. **Mobile-first.** Write the phone layout unconditionally, then layer wider
   screens with `t.mq()`. Min-width queries only. Above `md`, reflow — don't
   just stretch a max-width.
7. **Server Components by default.** Add `'use client'` only when something
   actually needs interactivity or browser APIs, at the smallest scope. The
   layout primitives are server components — keep them that way.
8. **No `any`, no non-null `!`.** `strict` is on; keep it meaningful.
9. **Copy follows `docs/design-system.md` §5.** Dry engineering-team humour,
   second person, short sentences. Sentence case, verb-first buttons, no
   exclamation stacking, no mascot-speak. Errors say what happened and what to
   do next.
10. **Blocked is not disabled.** An unavailable action keeps its control live
    and focusable, and says what's missing in the label ("Pick 2 more"). That's
    `Button`'s `blocked` prop.
11. **Never run `playwright install`** and never bump `@playwright/test` off
    1.56.1 — it is pinned to the provisioned Chromium build. See
    `docs/adr/0002-pin-playwright-to-browser-build.md`.
12. **`CLAUDE.md` is ours, `AGENTS.md` is Next's.** `next dev` rewrites the
    marked block in `AGENTS.md`. Never put project rules there.
13. **Never commit secrets.** `.env.example` documents the shape; real values
    live in `.env.local`.

## Architecture

Four routes: `/` and `/components` are static, `/room/[code]` is dynamic and
client-driven, and `/api/gifs` proxies Giphy so the key stays server-side. The
round flow's engine is built (`lib/game` pure core, `lib/room` host engine) and
four of its ten phases have screens; the rest render `PhasePending` until phase
3. `app/layout.tsx` owns fonts, global CSS and `app/tokens.scss` (which
publishes the token custom properties). Components are tiered atoms → molecules
→ organisms by *dependency*, not size; pages compose and hold almost no markup.

Tokens flow Sass → CSS custom properties → `theme/tokens.ts`, so values exist
once. `theme/tokens.ts` holds names only. `e2e/tokens.spec.ts` guards the bridge.

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
- [ ] Copy was reviewed against `docs/design-system.md` §5
- [ ] Interactive elements are keyboard-reachable with a visible focus ring and
      clear 44px touch targets
- [ ] A design artifact or screenshot was shared for anything visual
- [ ] `/ship` was run, so `docs/architecture.md` reflects the change

## Responding

The audience is product and front-end. Lead with what changed and what it
means; keep the rest short. Show a screenshot or artifact rather than
describing a layout in prose. Skip narration of routine tool steps — report
outcomes, and say plainly when something failed or was skipped.
