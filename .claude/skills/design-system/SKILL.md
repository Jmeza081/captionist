---
name: design-system
description: How to build UI that follows Captionist's design system — atomic tier placement, token usage, component file shape, and copy rules. Use before writing or changing any component or page layout.
---

# Building to the design system

`docs/design-system.md` is the reference. This is how to apply it.

## 1. Which tier?

Decide by **dependencies, not size**. A 200-line atom is still an atom.

```
Does it fetch data, subscribe to Ably, or read the route?  → organism
Does it import another component from this repo?           → molecule
Neither?                                                    → atom
```

Pages in `app/` compose organisms and molecules and hold almost no markup.

## 2. Before creating anything

Run the `component-scout` agent, or do its job by hand: read the inventory
table in `docs/design-system.md`, then `components/**`.

1. Something already does this → use it.
2. Something nearly does → **add a prop to it**. A variant is a prop, never a
   copy-pasted sibling.
3. Neither → create it, and say why 1 and 2 failed.

## 3. File shape

```
components/<tier>/ComponentName/
  ComponentName.tsx          # named export, props interface exported too
  ComponentName.module.scss  # starts `@use 'theme' as t;`
  index.ts                   # re-exports both
```

Import as `@/components/atoms/Button`. `'use client'` only if the component
needs interactivity — and put it on the smallest component that needs it, not
on the page.

`components/atoms/Button` is the canonical template; copy its shape.

## 4. Styling

Always:

```scss
@use 'theme' as t;
```

That one path forwards colours, typography, spacing, and breakpoints — so
compliance is greppable. A `.module.scss` without it isn't using the system.

- **Spacing, colour, radius:** tokens only (`t.$space-4`, `t.$charcoal-900`,
  `t.$radius-md`). Missing a value? Add it to `theme/` and document it in
  `docs/design-system.md` *before* you use it. Optical one-offs — a `1px`
  border, a small `translateY` nudge — are fine.
- **Type:** the mixins, not ad-hoc sizes — `t.bodyText`, `t.titleText`,
  `t.codeText`. They're `clamp()`-based, so one declaration covers phone
  through desktop.
- **Breakpoints:** `@include t.mq('md') { ... }`, min-width only. Write the
  phone layout unconditionally first.
- **Spacing lives on the container:** `gap` on the flex/grid parent, not
  margins on each child.
- **Full-height:** `min-height: 100vh` then `min-height: 100dvh`.
- **Touch targets:** at least `t.$tap-target-min` in both dimensions.
- **Focus:** every interactive element gets a visible `:focus-visible` ring —
  `2px solid t.$honey-mustard`, `2px` offset.

`$honey-mustard` means focus or live. `$massacre` means the primary action.
Neither is decorative.

## 5. Copy

Write the strings as carefully as the markup — see `docs/design-system.md` §4.
Sentence case everywhere. Buttons start with a verb and name the outcome
("Join room", not "Submit"). No exclamation marks. Mobile headings are six
words or fewer. Errors say what happened, then what to do next. Terms specific
to Captionist go in the glossary.

## 6. Finishing

Append the component to the inventory table in `docs/design-system.md` — name,
tier, path, and a "use when" that distinguishes it from its neighbours. A
component that isn't in the table won't be found by the next reuse audit, which
is how a codebase ends up with three buttons.
