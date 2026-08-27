# Components

Organised by [atomic design](https://bradfrost.com/blog/post/atomic-web-design/).
The tier is decided by dependencies, not by size — a 200-line atom is still an
atom, and a 10-line component that subscribes to Ably is an organism.

| Tier | May contain | May **not** contain |
| --- | --- | --- |
| `atoms/` | Markup, tokens, its own props | App state, data fetching, other components from this repo |
| `molecules/` | Atoms, layout, local UI state | Data fetching, realtime subscriptions, routing side effects |
| `organisms/` | Molecules, atoms, data fetching, Ably subscriptions, routing | — |

Pages in `app/` compose organisms and molecules. They should hold almost no
markup of their own.

## Layout primitives

`Stack`, `Inline`, `Box` and `Grid` are atoms that exist so spacing is a prop
instead of a re-declaration:

```tsx
<Stack gap={26} align="center">      // vertical, 26px between children
<Inline gap={8} justify="between">   // horizontal, wraps by default
<Box padding={20} radius="card" background="card">
<Grid columns={1} mdColumns={3} gap={12}>
```

`gap` and `padding` take a token from the scale, type-checked — `gap={13}` is a
compile error because 13px isn't in the design. All four are server components
and take an `as` prop, so the markup stays semantic (`as="section"`, `as="ul"`).

Reach for one before writing `display: flex` in a `.module.scss`. What belongs
in the stylesheet is what a primitive can't express: a `max-width` measure, a
type mixin, a bespoke background.

## Before you add a component

Search first. Every new component is a maintenance cost and a chance for two
things to drift apart. In order:

1. Does an existing component already do this? Use it.
2. Does one nearly do it? Add a prop to it. A variant is a prop, never a
   copy-pasted sibling component.
3. Only then create a new one — and say in your PR or response why 1 and 2
   didn't work.

New components must be appended to the inventory table in
[`docs/design-system.md`](../docs/design-system.md).

## File shape

Every component is a directory with three files:

```
ComponentName/
  ComponentName.tsx          # the component
  ComponentName.module.scss  # styles, always `@use 'theme' as t;`
  index.ts                   # re-export, so imports stay `@/components/...`
```
