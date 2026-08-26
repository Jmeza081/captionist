# 0001 — Upgrade to Next 16 and the App Router before codifying conventions

**Status:** accepted · 2026-08-26

## Context

The repo was a `create-next-app` scaffold on Next 12.0.10, React 17, and the
Pages Router, with one page and no components, tests, or docs. The task was to
set up a Claude Code workflow — `CLAUDE.md`, agent rules, a feature pipeline —
that encodes how features get built here.

Writing those rules against Next 12 would have meant teaching every future turn
Pages Router idioms: `_app.tsx`, `getServerSideProps`, `<Head>`, no Server
Components. Since the conventions are read on every turn, a stale baseline
compounds — and the upgrade would then invalidate the whole config.

## Decision

Upgrade first, then document. Next 12 → 16.3.3, React 17 → 19.2, TypeScript
4.5 → 5.9, and migrate `pages/` to `app/` before writing any agent config.

Also replaced three deprecated dependencies that were installed but never
imported, making the swap zero-risk: `@ably-labs/react-hooks` → `ably` v2,
`@dicebear/avatars*` → `@dicebear/core` + `collection` v9, `phosphor-react` →
`@phosphor-icons/react`.

## Consequences

- The rules in `CLAUDE.md` describe Server Components, `next/font`, and the
  metadata API — what we actually want — rather than legacy patterns.
- `next lint` was removed in Next 16, so `.eslintrc.json` became
  `eslint.config.mjs` using the flat configs `eslint-config-next` now exports.
- `package-lock.json` was rewritten from lockfileVersion 1 to 3. Expected, and
  the reason the upgrade is its own commit — a revert shouldn't take the
  workflow config with it.
- Turbopack uses the modern Sass API, so `sassOptions.includePaths` had to
  become `loadPaths`. The old root-relative `@use 'theme/colors'` imports were
  working by a Next default rather than by configuration; that is now explicit.
- Next 16 auto-generates `AGENTS.md` and `CLAUDE.md` on `next dev`. See the
  conventions note in [architecture.md](../architecture.md).
