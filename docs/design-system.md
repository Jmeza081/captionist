# Captionist design system

The rules new UI must follow. Tokens live in `theme/`, this file is the
reference for how to use them.

Status: **early**. The palette is real, the component inventory is small. When
a rule here is missing, propose the addition in this file in the same change
that needs it — do not improvise a one-off value in a component.

---

## 1. Tokens

Everything is exposed through one entry point. Component styles always start:

```scss
@use 'theme' as t;
```

Then reach tokens as `t.$space-4`, `t.$charcoal-900`, `t.mq('md')`. This makes
compliance greppable: a `.module.scss` that doesn't `@use 'theme'` is not using
the design system.

### Colour — `theme/_colors.scss`

Dark-first. The app's ground is charcoal; white is applied at opacity steps
rather than as separate greys.

| Token | Value | Use for |
| --- | --- | --- |
| `$charcoal-900` | `#0E0F10` | Page background |
| `$charcoal-800` | `#131415` | Raised surfaces, cards |
| `$charcoal-700` | `#161718` | Inputs, secondary buttons |
| `$massacre` | `#FF416C` | Primary action |
| `$rose-petal` | `#FF4B2B` | Primary hover, selection |
| `$honey-mustard` | `#F6E338` | Focus rings, live/recording state |
| `$white-100` | `rgba(255,255,255,1)` | Primary text |
| `$white-75` | `rgba(255,255,255,.75)` | Body and secondary text |
| `$white-50` | `rgba(255,255,255,.5)` | Captions, placeholders |
| `$white-25` | `rgba(255,255,255,.25)` | Borders, dividers |

Two colours carry meaning and must not be used decoratively: `$honey-mustard`
means focus or live, `$massacre` means the primary action.

### Spacing — `theme/_spacing.scss`

4px base. `$space-1` (4px) through `$space-10` (128px), plus `$radius-sm/md/lg/full`
and `$tap-target-min` (44px).

### Type — `theme/_typography.scss`

Mixins, not variables, so a call site gets family, size, weight, line-height,
and colour together: `displayText`, `titleText`, `headingText`, `bodyText`,
`labelText`, `captionText`, `codeText`. Every size is `clamp()`-based, so one
declaration covers phone through desktop. (`heroText` is a deprecated alias for
`displayText`, kept only so old call sites compile.)

### Breakpoints — `theme/_breakpoints.scss`

`t.mq('sm' | 'md' | 'lg' | 'xl')` → 480 / 768 / 1024 / 1280px, **min-width only**.

---

## 2. Layout and spacing rules

1. **Mobile-first, always.** Write the phone layout unconditionally, then layer
   wider screens on with `t.mq()`. There is no max-width mixin on purpose — a
   max-width query means the mobile case was treated as the exception.
2. **Tokens only.** No raw `px`, `rem`, or hex for spacing, colour, or radius in
   any `.module.scss`. If the value you need doesn't exist, add it to `theme/`
   and document it here first. (Optical one-offs — a `1px` border, a
   `translateY(-1px)` nudge — are fine; the rule is about the scale, not about
   every number.)
3. **Page gutter** is `$space-4` on mobile, `$space-6` from `md` up.
4. **Tap targets** are at least `$tap-target-min` (44px) in both dimensions.
5. **Full-height layouts** use `min-height: 100dvh` with a `100vh` line above it
   as fallback. Plain `100vh` is wrong on mobile browsers with a collapsing
   toolbar.
6. **Spacing goes on the container, not the children.** Prefer `gap` on a flex
   or grid parent over margins on each child, so a component's spacing is
   readable in one place.
7. **Desktop is not just "wider".** Above `md`, reflow — don't stretch. A column
   that reads well at 393px becomes an unreadable 1400px line if you only
   raise `max-width`.

---

## 3. Component usage rules

1. **One component per job.** Two components that render a button is a bug.
2. **A variant is a prop, not a new component.** Need a different look? Add it
   to the existing component's `variant` union.
3. **Reuse before you create.** Search `components/`, `theme/`, and the
   inventory below first. If you create something new, say why an existing
   component couldn't be extended.
4. **Respect the tier boundary** in [`components/README.md`](../components/README.md).
   Atoms hold no app state and import no other repo components; molecules
   compose atoms; only organisms fetch data or subscribe to Ably.
5. **Pages compose, they don't draw.** A file in `app/` should be mostly
   imports and layout, with almost no markup of its own.
6. **Every component ships with its styles.** `Component.tsx` +
   `Component.module.scss` + `index.ts`, in a directory named for the component.
7. **New components get added to the inventory table below** in the same change.

### Component inventory

| Component | Tier | Path | Use when |
| --- | --- | --- | --- |
| `Button` | atom | `components/atoms/Button` | Any clickable action. Variants: `primary` (one per view), `secondary`, `ghost` |
| `RoomCode` | atom | `components/atoms/RoomCode` | Displaying a room code for reading aloud or typing |
| `JoinPanel` | molecule | `components/molecules/JoinPanel` | Offering both ways into a room — scan the QR, or type the code |

---

## 4. Copy and voice

Copy is part of the interface, not a label applied afterwards. It is reviewed
in the research phase of every feature, before the component is built.

**Voice:** plain, second person, calm. This is a tool people use while someone
else is talking — it should never demand attention it hasn't earned.

1. **Sentence case everywhere.** Buttons, headings, labels, menu items. Never
   Title Case.
2. **Buttons start with a verb** and name the outcome: "Join room", "Start
   captions", "Copy code" — not "Submit", "OK", "Continue".
3. **No exclamation marks.** No "Oops", no "Woohoo", no emoji in product copy.
4. **Headings are six words or fewer** on mobile. If it doesn't fit on one line
   at 393px, it's too long.
5. **Errors state what happened and what to do next**, in that order: "That room
   code doesn't exist. Check the code and try again." Never "Something went
   wrong" alone, and never a raw error code as the whole message.
6. **Say "you", not "the user".** Avoid "please" — it pads without helping.
7. **No undefined jargon.** Terms specific to Captionist are defined in the
   glossary below the first time they appear in the UI.
8. **Numbers and codes are formatted for reading**, not for storage: room codes
   grouped and monospaced, timestamps relative ("2 minutes ago") in live views.

### Glossary

| Term | Means |
| --- | --- |
| Room | A single captioning session that guests join |
| Room code | The short human-typable identifier for a room, e.g. `C-F34213` |
| Host | The person who opened the room and whose audio is captioned |
| Guest | Anyone who joined the room to read captions |

---

## 5. Accessibility floor

Not aspirational — these are merged-or-not conditions.

- Body text meets WCAG AA (4.5:1) against its background. `$white-50` on
  `$charcoal-900` is for decorative text only, never body copy.
- Every interactive element has a visible `:focus-visible` style. The app-wide
  focus ring is `2px solid $honey-mustard` at `2px` offset.
- Colour is never the only signal. Pair it with text or an icon.
- The whole join flow is operable by keyboard alone.
- Codes and IDs are exposed to screen readers spelled out, not as words — see
  `RoomCode` for the pattern.
