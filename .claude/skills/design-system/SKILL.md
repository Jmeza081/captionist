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

That one path forwards colours, typography, spacing, breakpoints, elevation and
motion — so compliance is greppable. A `.module.scss` without it isn't using the
system.

- **Layout first:** before writing `display: flex`, reach for `Stack`,
  `Inline`, `Box` or `Grid`. Spacing is a prop on the container
  (`<Stack gap={26}>`), not a re-declaration in a stylesheet. What's left in a
  `.module.scss` should be what a primitive can't express.
- **Spacing, colour, radius:** tokens only (`t.$space-12`, `t.$surface-card`,
  `t.$radius-card`). Missing a value? Check the design first — if it isn't there
  either, add it to `theme/` and document it in `docs/design-system.md` *before*
  you use it. Optical one-offs — a `1px` border, a small `translateY` nudge —
  are fine.
- **The scale is not a 4px grid.** It's `2/5/6/8/10/12/14/20/26/34/44/52`, and
  each token is named for its own pixel value. Never round to a grid.
- **Type:** the mixins, not ad-hoc sizes — `t.bodyText`, `t.screenTitleText`,
  `t.cardTitleText`, `t.eyebrowText`, `t.roomCodeText`. They're `clamp()`-based,
  so one declaration covers phone through desktop. Nothing below 12px.
- **Breakpoints:** `@include t.mq('md') { ... }`, min-width only. Write the
  phone layout unconditionally first.
- **Full-height:** `min-height: 100vh` then `min-height: 100dvh`.
- **Touch targets:** at least `t.$tap-target-min` in both dimensions.
- **Focus:** every interactive element gets a visible ring — `@include
  t.focusRing`, which is `inset 0 0 0 2px t.$accent`.
- **Overlays:** place by the z-index ladder in `theme/_elevation.scss`
  (`$z-rail` 40 → `$z-snackbar` 95), never by picking a bigger number.

`$accent` means the primary action, focus, or selection. `$winner` means first
place. `$urgent` means urgency or destruction. None is decorative.

## 5. Copy

Write the strings as carefully as the markup — see `docs/design-system.md` §5.
Dry engineering-team humour, second person, short sentences — deploys, prod,
on-call, retros are the shared vocabulary. Sentence case everywhere. Buttons
start with a verb and name the outcome ("Start round", not "Submit"). No
exclamation stacking, no mascot-speak. Mobile headings are six words or fewer.
Errors say what happened, then what to do next. A blocked action says what's
missing in its label ("Pick 2 more") rather than going grey. Game-specific terms
go in the glossary.

## 6. Finishing

Append the component to the inventory table in `docs/design-system.md` — name,
tier, path, and a "use when" that distinguishes it from its neighbours. A
component that isn't in the table won't be found by the next reuse audit, which
is how a codebase ends up with three buttons.
