---
name: feature
description: The feature pipeline for Captionist — research, reuse audit, design artifact, build, verify, ship. Use for any request that adds or changes user-facing behaviour, whether or not the user typed /feature.
---

# Feature workflow

Five phases, in order. Each gates the next. Announce which phase you're in as
you go — one line, not a status report.

## Does this apply?

**Yes** for anything that adds or changes what a person sees or does: a new
screen, a new component, changed copy, a layout change, a new interaction.

**Escape hatch** — skip phases 1 and 3 for typo fixes, dependency bumps,
one-line bug fixes, and pure refactors with no visual change. **Say which
phases you skipped** so the user can push back. When you're unsure whether
something is small, treat it as a feature.

---

## Phase 1 — Research

Delegate to the `ux-researcher` agent. Give it the feature request verbatim
plus any constraint the user stated.

**Gate: no component code before the brief comes back.** The brief decides the
pattern and the copy; building first makes the research decorative.

Read the brief and say in one or two sentences what you're taking from it. If
you disagree with a recommendation, say so and why — the brief is input, not
an order.

## Phase 2 — Reuse audit

Delegate to `component-scout` with the list of UI elements the feature needs.

Act on its verdicts. **Reuse** and **Extend** are the expected answers; if it
returns **New**, restate the justification in your own response so the user
sees the cost being paid deliberately.

If it flags a missing token, add it to `theme/` and document it in
`docs/design-system.md` *before* writing the component that needs it.

## Phase 3 — Design artifact

Anything with a visual surface gets something the user can look at, in chat,
before or alongside the build:

1. **Preferred:** publish an Artifact. Load the `artifact-design` skill first.
   Build the mockup with the real tokens from `theme/` — the same surfaces, the
   same `#7B61FF` accent, the same uneven spacing scale — so it reads as this
   product and not a generic wireframe.
2. **Fallback:** if publishing fails, build the real thing and capture a
   Playwright screenshot at both viewports (see the `e2e` skill), then send it
   with `SendUserFile`.

Never describe a layout in prose as a substitute. Show it.

## Phase 4 — Build

Follow `docs/design-system.md` and the non-negotiables in `CLAUDE.md`. In
short: tokens only, mobile-first, right atomic tier, Server Components unless
interactivity demands otherwise, sentence-case verb-first copy.

Append every new component to the inventory table in `docs/design-system.md`
in the same change.

## Phase 5 — Verify and ship

1. `npm run verify` — lint, typecheck, build.
2. Write or extend an E2E spec covering the new behaviour, then
   `npm run test:e2e`. Both projects must pass. See the `e2e` skill.
3. Run `/ship` to refresh the docs.

Then check every box in the **Definition of done** in `CLAUDE.md` before you
report the feature complete. If a box can't be checked, say which and why —
don't report done.
