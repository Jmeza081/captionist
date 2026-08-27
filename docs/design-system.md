# Captionist design system

The rules new UI must follow. Tokens live in `theme/`, this file is the
reference for how to use them.

**Source of truth:** `DESIGNSYSTEM.md` from the design project, plus the three
`.dc.html` files (prototype, screens, component library). Every value in
`theme/` is copied verbatim from there. When this file and the design disagree,
the design wins and this file is the bug.

---

## 1. Tokens

Everything is exposed through one entry point. Component styles always start:

```scss
@use 'theme' as t;
```

Then reach tokens as `t.$space-12`, `t.$surface-card`, `t.mq('md')`. This makes
compliance greppable: a `.module.scss` that doesn't `@use 'theme'` is not using
the design system.

### Colour — `theme/_colors.scss`

Dark-first. Surfaces are named for **what they carry**, not for a lightness
number — the ramp is deliberately uneven, so "the next one up" is a design
decision the name has to make for you.

| Token | Value | Carries |
| --- | --- | --- |
| `$surface-canvas` | `#0A0A0B` | App canvas |
| `$surface-lobby` | `#0D0E0F` | Lobby, scoreboard |
| `$surface-header` | `#0E0F10` | Header fill, chat rail |
| `$surface-vote` | `#131415` | Vote canvas, setup canvas |
| `$surface-modal` | `#17181A` | Modal / interstitial card |
| `$surface-card` | `#1B1C1C` | Cards, popovers, toolbox |
| `$surface-timer` | `#1D1E1F` | Timer pill (neutral) |
| `$surface-snackbar` | `#232426` | Snackbar |
| `$surface-track` | `#242425` | Segmented-control track |
| `$surface-field` | `#303031` | Fields, active segment |

Accents:

| Token | Value | Means |
| --- | --- | --- |
| `$accent` | `#7B61FF` | Primary action, focus ring, selection |
| `$accent-hover` | `#8B74FF` | Primary hover |
| `$accent-text` | `#A18FFF` | Accent text, eyebrows, links |
| `$accent-on-fill` | `#C9BCFF` | Icons/text on accent fills |
| `$winner` | `#F6E338` | Winner, 1st place |
| `$success` | `#83D06C` | Success, online, submitted |
| `$urgent` | `#FF787D` | Urgency (≤15s), destructive, unread |

These carry meaning and must not be used decoratively. Tints and borders are
tokenised too (`$accent-fill-weak/-fill/-fill-strong`, `$accent-border-*`,
`$urgent-fill`, `$winner-fill*`) — pick one rather than inventing an alpha.

Text on dark is named by role: `$text-primary` (`#fff`), `$text-chat` (.78),
`$text-body` (.55), `$text-label` (.45), `$text-meta` (.4), `$text-caption`
(.35), `$text-timestamp` (.3).

### Spacing — `theme/_spacing.scss`

**This is not a 4px grid, and rounding to one is a bug.** The design specifies
an uneven set and says so explicitly. Each token is named for its own pixel
value, so there is no arithmetic to infer:

`$space-0 · 2 · 5 · 6 · 8 · 10 · 12 · 14 · 20 · 26 · 34 · 44 · 52`

If a value isn't there, it isn't in the design either — check the spec before
adding one, then document it here.

Named measurements, because the spec gives ranges rather than single values.
Each range becomes two endpoint tokens so a component picks a side instead of
inventing something between them:

| Token | Value | For |
| --- | --- | --- |
| `$screen-pad-h` / `-lg` | 40 / 60px | Screen padding, horizontal |
| `$screen-pad-v` / `-lg` | 24 / 56px | Screen padding, vertical |
| `$card-pad` / `-lg` | 20 / 26px | Card padding |
| `$header-height` | 72px | Header |
| `$rail-pad` | 16px | Chat rail padding |
| `$rail-width` / `-collapsed` | 360 / 64px | Chat rail |
| `$tap-target-min` | 44px | Minimum touch target |

Radii are named for what they wrap: `$radius-pill` (143px — not a typo, it
renders any normal-height button as a true pill), `$radius-modal` (24),
`$radius-card` (16), `$radius-field` (12) / `-lg` (14), `$radius-toolbox` (10),
`$radius-media` (8) / `-lg` (9), `$radius-pip` (99), `$radius-avatar` (50%).

### Type — `theme/_typography.scss`

Mixins, not variables, so a call site gets family, size, weight, tracking,
line-height and colour together. Where the spec gives a range it's `clamp()`-ed,
low end on a phone: `displayText`, `screenTitleText`, `cardTitleText`,
`sectionHeadingText`, `bodyText`, `chatBodyText`, `labelText`, `eyebrowText`,
`scoreText`, `roomCodeText`.

Nothing goes below 12px. `eyebrowText` applies `text-transform`, so the string
in the `.tsx` stays sentence case and readable.

### Elevation — `theme/_elevation.scss`

Shadows named for the surface they lift, because they aren't a ramp:
`$shadow-popover`, `$shadow-toolbox`, `$shadow-snackbar`, `$shadow-modal`
(purple glow), `$shadow-modal-error` (destructive swap), `$shadow-winner`.
Plus `focusRing()`, `hairline($side)`, `backdrop()`, and the full z-index
ladder (`$z-rail` 40 → `$z-snackbar` 95) so a new overlay is placed by reading
the ladder, not by guessing a bigger number.

### Motion — `theme/_motion.scss`

`keyframes()` declares `pop`, `pulse`, `rise`, `toastin` and `gcy` once, from
`app/tokens.scss`. The spec requires these live in a stylesheet, never driven
inline from JS.

### Breakpoints — `theme/_breakpoints.scss`

`t.mq('sm' | 'md' | 'lg' | 'xl')` → 480 / 768 / 1024 / 1280px, **min-width only**.

### Reaching tokens from React — `theme/tokens.ts`

The layout primitives take spacing as a prop (`<Stack gap={26}>`), which Sass
variables can't provide. Rather than keeping a second copy of the scale in TS:

1. `theme/_css-vars.scss` walks the Sass maps and emits every spacing and
   radius token as a CSS custom property.
2. `app/tokens.scss` includes that once at `:root`.
3. `theme/tokens.ts` exports only the **names** and the `var()` references.

So `theme/tokens.ts` contains no values, `gap={13}` is a type error because
13px isn't in the design, and changing a value stays a one-line edit in Sass.
`e2e/tokens.spec.ts` guards the bridge — if it breaks, gaps silently fall back
to `0` and nothing else would fail.

In a `.module.scss`, keep using `t.$space-12`. The TS module is only for the
primitives.

---

## 2. Layout and spacing rules

1. **Mobile-first, always.** Write the phone layout unconditionally, then layer
   wider screens on with `t.mq()`. There is no max-width mixin on purpose — a
   max-width query means the mobile case was treated as the exception.
2. **Tokens only.** No raw `px`, `rem`, or hex for spacing, colour, or radius in
   any `.module.scss`. If the value you need doesn't exist, check the design,
   then add it to `theme/` and document it here. (Optical one-offs — a `1px`
   border, a `translateY(-1px)` nudge — are fine.)
3. **Never round to a grid.** The scale is uneven on purpose.
4. **Reach for a primitive before writing `display: flex`.** `Stack`, `Inline`,
   `Box` and `Grid` exist so spacing is a prop, not a re-declaration. A
   `.module.scss` with `display: flex; gap:` in it is usually a missed `Stack`.
5. **Spacing goes on the container, not the children.** Which is what the
   primitives enforce.
6. **Tap targets** are at least `$tap-target-min` (44px) in both dimensions.
7. **Full-height layouts** use `min-height: 100dvh` with a `100vh` line above it
   as fallback.
8. **Desktop is not just "wider".** Above `md`, reflow — don't stretch.

---

## 3. Component usage rules

1. **One component per job.** Two components that render a button is a bug.
2. **A variant is a prop, not a new component.**
3. **Reuse before you create.** Search `components/`, `theme/`, and the
   inventory below first. If you create something new, say why an existing
   component couldn't be extended.
4. **Respect the tier boundary** in [`components/README.md`](../components/README.md).
5. **Pages compose, they don't draw.**
6. **Every component ships with its styles.** `Component.tsx` +
   `Component.module.scss` + `index.ts`.
7. **New components get added to the inventory table below** in the same change.

### Component inventory

| Component | Tier | Path | Use when |
| --- | --- | --- | --- |
| `Stack` | atom | `components/atoms/Stack` | Vertical layout. The default way to space a column — `gap`, `padding`, `align`, `justify`, `as` |
| `Inline` | atom | `components/atoms/Inline` | Horizontal layout. Wraps by default; same props as `Stack` plus `wrap` |
| `Box` | atom | `components/atoms/Box` | A surface — `padding`, `radius`, and a named `background` from the palette |
| `Grid` | atom | `components/atoms/Grid` | Two-dimensional layout. `columns` / `mdColumns` reflow at `md` |
| `Button` | atom | `components/atoms/Button` | Any clickable action. Variants: `primary` (one per screen), `secondary`, `outline`, `destructive`, `ghost`. Sizes: `inline`, `form` (51px CTA), `toolbox`. `blocked` for "not yet, and here's why" |
| `RoomCode` | atom | `components/atoms/RoomCode` | Displaying a room code for reading aloud or typing |
| `JoinPanel` | molecule | `components/molecules/JoinPanel` | Offering both ways into a room — scan the QR, or type the code |

Not yet built, specified in the design: segmented control, text field, toggle,
stepper, dropzone, timer pill, avatar, media card, prompt banner, chat message,
reaction CTA, reaction toolbar, tally pill, snackbar, modal, round-opener
interstitial, chat rail, host toolbox.

---

## 4. Interaction rules

From `DESIGNSYSTEM.md` §4. These are product rules, not suggestions.

1. **One primary action per screen** — the one that advances the phase.
2. **Every invisible action confirms** with a snackbar (copy link, share, mode
   switch, upload accepted).
3. **One overlay surface at a time** — opening one picker closes the others.
4. **Reaction affordances are uniform** — smiley-plus icon, searchable toolbar,
   everywhere. Never a bare `+`.
5. **Anonymity until reveal** — no author names on vote cards in either mode.
6. **Timers are honest** — phases auto-advance at zero; ≤15s turns the pill red.
7. **Blocked, not disabled** — state what's missing in the label ("Pick 2 more"),
   keep the control live and focusable. That's what `Button`'s `blocked` prop is.
8. **Chat is never modal** — it docks beside content, never over it.
9. **Mode is always legible** — header settings line, round opener, help modal.
10. **Uploads are first-class** — wherever Giphy is offered, upload is too.

---

## 5. Copy and voice

**Voice:** dry engineering-team humour, second person, short sentences.
Deploys, prod, on-call, retros and standups are the shared vocabulary. Never
cute mascot-speak, never exclamation stacking.

From the design, verbatim: *"Make it hurt. Make it funny."* · *"Brace yourself.
Last time they picked a 4-second clip of a burning server rack."* · *"Say
something regrettable…"* · *"Somebody has to break this tie."*

1. **Sentence case everywhere.** Buttons, headings, labels. Never Title Case.
   (`eyebrowText` uppercases in CSS — the string stays sentence case.)
2. **Buttons start with a verb** and name the outcome: "Start round", "Copy
   link", "Lock it in" — not "Submit", "OK", "Continue".
3. **Blocked buttons say what's missing**, in the label.
4. **Headings are six words or fewer** on mobile.
5. **Errors state what happened and what to do next**, in that order. Never a
   bare "Something went wrong", never a raw error code as the whole message.
6. **Say "you", not "the player".** Avoid "please".
7. **No undefined jargon.** Game-specific terms go in the glossary below.
8. **Numbers and codes are formatted for reading**: room codes tracked and
   tabular, timestamps relative ("2 minutes ago") in live views.

### Glossary

| Term | Means |
| --- | --- |
| Room | A single game session, 3–20 players over 5 rounds |
| Room code | The short human-typable room identifier, e.g. `C-F34213` |
| Round | One full loop: opener → setup → submit → vote → reveal → score |
| Mode | `caption` (caption a GIF) or `react` (answer a prompt with a GIF) |
| Captionist | The role holder in `caption` mode — supplies the GIF |
| Prompter | The role holder in `react` mode — supplies the text prompt |
| Host | The player who opened the room; controls timers and the toolbox |
| Reveal | The beat where authorship stops being anonymous |
| Podium | The final top-three screen after round 5 |

---

## 6. Accessibility floor

Not aspirational — these are merged-or-not conditions.

- Body text meets WCAG AA (4.5:1) against its background. `$text-body` (.55)
  and lighter fail on `$surface-canvas` — supporting text only, never the
  sentence a player must read to play.
- Every interactive element has a visible `:focus-visible` style. The ring is
  `inset 0 0 0 2px $accent`, available as `@include t.focusRing`.
- Colour is never the only signal. Pair it with text or an icon — the timer
  going red is also a number counting down.
- The whole join and vote flow is operable by keyboard alone.
- Codes and IDs are exposed to screen readers spelled out, not as words — see
  `RoomCode` for the pattern.
