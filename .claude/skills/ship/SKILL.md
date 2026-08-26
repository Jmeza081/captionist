---
name: ship
description: Closes out a completed feature — regenerates the repomix pack, refreshes architecture docs and diagrams, re-runs the full verification gate, and reports a changelog. Run after every feature.
---

# Ship

The last step of every feature. Makes the docs true again and proves the tree
is green.

Do not run this mid-feature. It is for work that is built and believed
finished.

## Steps

**1. Pack.** `npm run docs:pack`

Writes `docs/repomix-output.xml`. It is gitignored on purpose — it is an input
to doc generation, not a doc. If the security check flags a file, stop and tell
the user; do not commit anything until it's resolved.

**2. Refresh the docs.** Delegate to the `docs-cartographer` agent.

It reads the pack and updates `docs/architecture.md`: route map, component tier
diagram, rendering path, stack and command tables, and the "Not yet designed"
section. Read its report — if it says the code contradicts a doc, that's a real
finding, surface it.

**3. Inventory.** Confirm every component added in this feature is in the
inventory table in `docs/design-system.md`, with its tier, path, and a "use
when" that distinguishes it from its neighbours. Add any that were missed.

**4. Decisions.** If the feature involved a non-obvious architectural choice —
a new dependency, a data-flow shape, a deliberate constraint — write an ADR in
`docs/adr/NNNN-title.md` using Context / Decision / Consequences. Skip it for
routine work; an ADR per feature makes the directory useless.

**5. Verify.** `npm run verify && npm run test:e2e`

Both must be green. A failure here is the feature's problem, not ship's — go
fix it and start ship again.

**6. Report.** Five lines or fewer, for a product and front-end audience:

```
Shipped: <what a user can now do>
Components: <new or changed, with tiers>
Docs: <which sections changed>
Tests: <n passing across both viewports>
Follow-ups: <anything deliberately left, or "none">
```

## Rules

- Never commit `docs/repomix-output.xml`.
- Never mark ship complete with a red gate. Say what's failing instead.
- If nothing about the architecture changed, say so — a no-op doc update is a
  fine outcome and better than inventing a change to justify the step.
