# Components

Organised by [atomic design](https://bradfrost.com/blog/post/atomic-web-design/).
The tier is decided by dependencies, not by size — a 200-line atom is still an
atom, and a 10-line component that calls `useRoom()` is an organism.

| Tier | May contain | May **not** contain |
| --- | --- | --- |
| `atoms/` | Markup, tokens, its own props, `Icon` | App state, data fetching, any other component from this repo |
| `molecules/` | Atoms, layout, local UI state, **and another molecule where one genuinely composes another** | Data fetching, realtime subscriptions, routing side effects |
| `organisms/` | Molecules, atoms, data fetching, room state (`useRoom()`), routing | — |

**The gallery at `/components` holds the reusable library, not every file in
here.** A component built for exactly one page — `HeroWall`, `LandingNav`,
`LandingActions` — is covered by that page's own spec instead. Anything another
screen could plausibly want belongs in the gallery, and in the inventory.

It runs **under `next dev` only** (`page.dev.tsx` plus `pageExtensions`), and it
is tabbed by the tiers in the table above, so where a case appears is the same
claim this file makes about where the file lives. A new component goes in
`ComponentGallery/sections.ts` under its tier and then into the matching panel —
`AtomsPanel`, `MoleculesPanel`, `OrganismsPanel` — and `e2e/components.spec.ts`
checks the rail and the panel agree.

**`Icon` is the one exception**, and it's deliberate. It's a leaf that renders a
single `<svg>` — no state, no props beyond name/size/colour, and nothing it
could ever import. Forbidding it would push genuinely atomic components like
`ReactionCTA` (a smiley and a plus, and that is the whole component) into
`molecules/` on a technicality, which would make the tier say less, not more.
Nothing else gets this exemption: if a component imports anything from
`components/` other than `Icon`, it is a molecule.

**A molecule may hold another molecule, and three do.** `HelpModal` configures
`Modal` — the walkthrough is a thing the product has rather than a thing each
of its four entry points writes, and it holds nothing but which step and which
format you are reading. `RoomToolbox` renders `ReactionToolbar` inside its body — the picker is a section of the
toolbox rather than a popover over it, which is how the room's reactions stay
one open surface rather than two. `AppHeader` and `LandingNav` both render
`Wordmark`, which is a molecule for the narrower reason below: it is two
elements and no state, but it imports `Logo`, and `Icon` is the only exemption.
The tier is about *dependencies*, not depth:
neither component fetches, subscribes or routes, so both are still molecules
and the organism above them is still the only thing that knows a room exists.
The rule this does not licence is composing your way out of a tier — if the
inner component needs `useRoom()`, the pair belongs in `organisms/`.

**An organism may hold another organism, and two do.** `ComposeScreen` renders
`WaitingScreen` for the viewer whose entry is in — the phase is still `compose`,
and a second set of "we are waiting" strings is two that drift. `BriefScreen`
and `ComposeScreen` both render `RoundPicker`, the GIF board a round is searched
on: one screen, two modes, differing in a headline and what sits above it. The
bar for this is the same as for a molecule holding a molecule — one genuinely
composes the other — and `RoundPicker` is an organism at all only because it
speaks through `useRoomShell()`.

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
