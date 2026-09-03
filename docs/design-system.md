# Captionist design system

The rules new UI must follow. Tokens live in `theme/`, this file is the
reference for how to use them.

**Source of truth:** [`design/`](../design/) — `DESIGNSYSTEM.md` plus the three
`.dc.html` files (prototype, screens, component library), committed as
delivered. Every value in `theme/` is copied verbatim from there. When this
file and the design disagree, the design wins and this file is the bug.

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
| `$surface-tab-active` | `#2A2B2C` | The reaction picker's selected pack tab |
| `$surface-field` | `#303031` | Fields, active segment |
| `$surface-vote-fade` | `rgba(19,20,21,0)` | The transparent end of `$surface-vote`, for a dock fading into what scrolls under it |

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

Scrims are tokenised for the same reason: `$scrim-wall` (`rgba(0,0,0,.75)`) is
the GIF wall's veil where display type sits on top of it, `$scrim-wall-soft`
(`.45`) where nothing does — `HeroWall`'s `scrim` prop picks between them, with
`$wall-scrim-blur` / `$wall-scrim-blur-soft` as the matching backdrop blurs.
`$scrim-own-entry`, `$scrim-tally` and `$scrim-backdrop` cover the rest.

`SceneBackdrop` draws television static while its clip is still being fetched —
a set tuned to a channel that is not there — and that picture has tokens of its
own:

| Token | Value | Draws |
| --- | --- | --- |
| `$static-grain` | `160px` | One tile of noise. Fine, because a CRT's dots are |
| `$static-scanline` | `rgba(0,0,0,.35)` | The gap between scanlines |
| `$static-scanline-width` | `1px` | One line, and the gap after it — 2px reads as blinds |
| `$static-sweep` | `rgba(255,255,255,.06)` | The pale edges of the rolling tear |
| `$static-tear` | `rgba(0,0,0,.45)` | Its dark centre |
| `$scrim-static` | `rgba(0,0,0,.62)` | The veil over all of it, on the backdrop and the wall alike |

`$scrim-static` is its own weight rather than reusing a wall scrim, and the
reason is worth keeping: `$scrim-wall` (.75) **plus its blur** is what media we
did not choose needs, and over a picture made entirely of high frequency it
leaves flat grey — the effect vanishes. `$scrim-wall-soft` (.45) shows the
picture but lets near-white dots up under a headline. So static takes .62 and
**no blur at all**, whatever `scrim` the caller asked for.

The picture itself is two hard levels, not a grey ramp, and it swaps between
five differently-seeded fields rather than sliding one around. Both are
legibility decisions as much as aesthetic ones: a low-contrast field slid about
changes so little between frames that it reads as not moving at all, which is
how the first version shipped looking frozen while its animation was genuinely
running.

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

### Component metrics — `theme/_metrics.scss`

The design has **two** spacing systems, and conflating them is what makes a
component drift:

1. The gap scale above — distance *between* things, and what the layout
   primitives take as props.
2. `_metrics.scss` — the paddings, heights and insets each component is drawn
   at (`$btn-pad-y` 15px, `$timer-pad-x` 15px, `$field-height-caption` 62px).
   These are per-component values from the component library, not steps on a
   scale, and there is no arithmetic relationship between them.

Keeping them apart means nobody reaches for `$space-14` because a button
happens to be 14px padded, then "fixes" the scale when a different button
isn't.

The quoted-caption block a reply carries is drawn from
`$chat-quote-radius` (9px), `$chat-quote-rule` (2px),
`$chat-quote-thumb` (30px) and `$chat-quote-thumb-radius` (5px), and the
picker's pack tabs from `$reaction-tab-pad-y` (6px) and `$reaction-tab-pad-x`
(11px). 11px is off the gap scale on purpose: the scale is the uneven set the
design specifies, and this is a component metric, not a step on it.

Three colours came with them — `$fill-quote` (`rgba(255,255,255,.04)`),
`$text-quote` (`rgba(255,255,255,.7)`) and `$accent-border-quote`
(`rgba(123,97,255,.6)`). The last is a shade heavier than
`$accent-border-strong` because the design distinguishes a rule that *marks a
quote* from one that edges a surface.

**A GIF picker's tiles are the GIF's own shape.** `GifPanel` used to draw a
grid of fixed-height tiles — 76px in the popover, 200px on the board — which
cropped every result to a letterbox, because Giphy's `fixed_width` rendition
pins the width at 200px and lets the height fall wherever the source does. The
tiles now carry `aspect-ratio` from `GifResult.width`/`height`, set per tile as
a `--tile-ratio` custom property, with `$gif-tile-ratio` (5:4) as the shape of
a GIF whose source reports no dimensions.

That means masonry, so the layout is CSS `columns` rather than `grid`: a grid
row is as tall as its tallest cell, and ragged tiles would leave a hole under
every short one. Two things follow, and both are in the stylesheet's comments.
Reading order becomes column-major, though tab order still follows the DOM. And
**the scroller has to be a wrapper, never the columns themselves** — a multicol
box with a capped height treats that height as its fragmentainer and lays the
overflow out sideways, which showed three tiles and hid the other nine.
`$gif-panel-scroll-cap` (320px) is also its own value now rather than the
`$toolbar-scroll-cap` it shared with the reaction toolbar: 196px is several
rows of 36px emoji tiles and about one and a half GIFs.

**And a tile that has no picture yet is a television.** Reserving the ratio kept
the board from reflowing but left the reserved area transparent — fifty lazily
loaded tiles, each an empty box behind a hairline until its WebP decoded, and
forever where it never did. `TunedImage` puts `TvStatic` behind each one, which
is the treatment the landing wall has given a cell since it shipped and what the
atom's own spec line always promised. `MediaCard` takes it too, so the vote grid,
the reveal and the compose preview stop drawing the same hole. It is off on the
composer's `popover` — twelve flickering thumbnails over a live chat rail is a
different amount of noise — which is `tuning={board}` and not a second tile.

It wears `$scrim-static`, the same veil `HeroWall` and `SceneBackdrop` put over
their sets, and at a picker's scale the reason is plainer than on either of them:
raw, fifty tiles of noise is the loudest thing on the page, and on a vote card it
is drawn behind a caption somebody has to read. Measured rather than assumed on
the other side too — fifty tiles all tuning holds a flat 60fps (median frame
16.7ms, worst 16.8ms, indistinguishable from one), so the `content-visibility`
hedge this might have needed is not needed.

The one thing that is not obvious: `onLoad` alone loses a race it loses often. A
cached GIF, a `data:` URI, anything that decodes inside the server HTML has
finished before hydration attaches the handler, so the event never arrives and
the static sits on top of a perfectly good picture forever. `TunedImage` checks
`complete && naturalWidth > 0` on mount for exactly that, and `naturalWidth` is
what keeps a broken image — which is `complete` too — reading as the failure it
is.

The split with `SceneBackdrop` — a backdrop settles to nothing, a tile settles
to a dead channel — is
[ADR 0027](./adr/0027-a-tile-that-never-tunes-in-keeps-hissing.md).

**And then everything else that waits on a GIF.** Five more: the composer's
staged attachment and its "Replying to" thumb, a sent message's attachment and
*its* quote thumb, and the vote screen's own subject thumbnail beside the
heading — the last of which is not a `MediaCard`, because it is a picture of the
thing being voted on rather than an entry. The chat *picker* is still plain,
which is the same call as before: a dozen flickering thumbnails over a live rail
is a different amount of noise from one.

Two things had to change for the fixed-size shape, and neither is about static:

`TunedImage`'s wrapper **declares no width.** A block box with `width: auto`
fills a block container, so the fluid call sites — a picker column, a media
card's frame, both of which put `width: 100%` on the *image* — are unchanged,
while a 30px quote, a 52×40 staged tile and an 88px subject shrink-wrap to the
size their image already carries. `width: 100%` served the first two and
stretched the other three. `flex: none` rides with it, because three of those
thumbs are flex items that carried it themselves.

**A broken image is an inline non-replaced box, and width and height do not
apply to one.** So `.thumb`, `.replyingThumb` and `.quoteThumb` are now
`display: block` — without it a pulled GIF collapsed the square to a strip of
spilled alt text, which it did long before there was a set behind it. Two more
follow from the same fact: `.tuner[data-tuning] img` is `color: transparent`, so
a dead channel is not captioned with the alt text in white (the attribute stays
on the element, so nothing an assistive tech reads changes), and
`ChatMessage`'s attachment — the one image in the app that deliberately reserves
nothing, `width: auto` so a 64px Slackmoji is never letterboxed into a banner —
takes the design's 180×120 off `[data-tuning]` until the picture is there.

**A tally pill is `ReactionCTA`'s height**, `$tally-height: 32px`. §4.4 gives
that pill its colours and nothing else, so the 4/8/12/11 it used to be drawn at
was ours rather than the design's — and beside a 32px CTA it read as a footnote
to the control that adds one. A reaction four people left should not be smaller
than the button offering to leave a fifth. It is a height rather than vertical
padding so the match is stated once and cannot drift when a glyph's leading
changes, and `.glyph` sizes an image tile in `em` so a picture and a character
come out the same without every call site passing a number.

The 404 page has two of its own — `$notfound-width` (1190px, the two columns
and the gutter between them) and `$notfound-lead-width` (480px) — for the same
reason the landing does: they belong to a page, not to any component on it.

**A media card is square, and its caption is sized against the card.** Both are
deliberate departures from DESIGNSYSTEM.md §3, and both replaced a number that
was written for a shape we do not draw:

| §3 says | Here | Why |
| --- | --- | --- |
| image height 170–210px | `aspect-ratio: var(--media-aspect, $media-ratio)` | At the widths the card is actually laid out at — 307px in the vote grid, 520px in the compose preview, 570px on the 404 — a 186px height is a 1.6:1 letterbox. A meme is square, the compose preview left half a column empty beneath itself, and a ratio governs every width from one number. **Amended in phase 7:** the square is now the *fallback*, not the rule. A GIF is any ratio it likes, and `cover` on a 16:9 photo forced into a square showed 56% of the frame — half the joke is usually in the other half. A card is drawn at its image's own ratio, clamped to the `MEDIA_ASPECT_MIN`–`MAX` band in `lib/media.ts` (4:5 → 4:3) so a vote grid stays a grid; a source that reports no size is still square |
| caption overlay 14–32px | `$media-overlay-size: clamp(1.375rem, 8cqw, 2.625rem)` | 14px was the floor of that range and the only value ever used, which on a square card is a label rather than a caption. The unit is `cqw`, not `vw`: a 307px vote tile and a 570px hero card sit at the same viewport, so only a card-relative unit gets both right. `.frame` declares `container-type: inline-size` for it |
| shadow `0 ±1.5–2px 0 #000` | `$media-overlay-shadow: 2px` | The top of the same range. At 14px 1.5px held the letter off the image; at 42px it is a hairline |

**Amended again:** the size is one of four steps, not one value.
`$media-overlay-size` is what a caption of a single line gets;
`$media-overlay-size-2/-3/-4` step it down as the caption grows, each roughly
the one above divided by its own line count, so the block of text stays about
the height one line was. Which step a caption gets is read off its *length* —
see `overlayStep` in `MediaCard.tsx` — because the size is in `cqw` and a card
therefore holds about 20 characters per line whatever its pixel width — that
number is `CHARS_PER_LINE` in `MediaCard.tsx` rather than a token, because no
stylesheet can read it and a token nothing consumes drifts from the one that
runs. No measuring, so `MediaCard` stays a server component. The overlay also carries `max-height: calc(50% - 10px)` and
`overflow-wrap: anywhere`: the two overlays share one frame, and before this a
long caption grew straight out through the bottom edge, where the frame's
`overflow: hidden` cut it in half without saying so.

Changing the shape back is one line: `$media-ratio: 4 / 3` and every screen
follows. The decision, and what it cost elsewhere, is
[ADR 0016](./adr/0016-a-media-card-is-square-and-a-caption-scales-with-it.md) —
including the one place `CLAUDE.md`'s "if code and design disagree, the code is
the bug" does not hold, and why a departure gets a row in a table rather than a
quiet edit.

### Type — `theme/_typography.scss`

Mixins, not variables, so a call site gets family, size, weight, tracking,
line-height and colour together: `displayText`, `displaySmallText`,
`screenTitleText`,
`cardTitleText`, `sectionHeadingText`, `bodyText`, `chatBodyText`, `labelText`,
`eyebrowText`, `scoreText`, `roomCodeText`.

**Sizes are `clamp(min, Arem + Bvw, max)` on 360px → 1440px anchors.** Two
rules, both of which the first implementation broke:

- *Never a bare `vw` preferred value.* WCAG technique **F94** names it a
  failure of SC 1.4.4 — `7.2vw` is 7.2% of the viewport whatever the reader
  sets as their default font size, so text-size preferences did nothing. The
  `rem` term restores them, and fixed sizes are in `rem` for the same reason.
- *Derive the slope, never guess it.* `clamp(38px, 7.2vw, 98px)` reaches its
  floor at 38 ÷ .072 = 528px, so it was a constant on every phone and only
  began scaling on a tablet. Nine of the ten mixins were flat below 750px.
  From the anchors, `slope = (max − min) ÷ 1080` and `intercept = min − slope ×
  360`, so the minimum lands *at* the minimum viewport by construction.

**Leading is inversely proportional to size**, which is why DESIGNSYSTEM.md
gives it as ranges (display `.94–1.06`, body `1.45–1.6`). Collapsing each to one
number and taking the tight end put 98px-desktop leading on a 38px phone
headline. Where the size range is wide enough that one ratio can't cover it —
`displayText` spans 2.0×, `screenTitleText` 1.4× — the leading is a second clamp
on the same anchors, expressed as a *length*. A length `line-height` does not
inherit as a ratio; that is safe only because every mixin declares its size and
leading together, so keep it that way.

**For `displayText`, target the optical gap, not the ratio.** Inter 800 sums a
descender and a cap-height to **0.978em** ('p' 0.204 + 'S' 0.774, measured), so
any leading under ~0.98 drives one line's descender into the capital below it
wherever the copy stacks that pair — and the landing hero, "Caption this. / Ship
that.", stacks exactly it. The spec's `.94` was overlapping its own ink by 3.7px
at 98px and by 1.0px at 66px; it is not a usable value for two-line copy in this
typeface, whatever the table says. The ramp therefore holds a constant ~7px
visible gap (1.12 at 360px → 1.04 at 1440px) rather than a constant ratio. The
ratio still falls with size, which is the principle; it is simply anchored to
where the ink actually lands. `e2e/typography.spec.ts` measures that gap
directly with `actualBoundingBox*` rather than asserting a ratio.

**Where DESIGNSYSTEM.md and the `.dc.html` files disagree, the markup wins.**
The guide's token tables are summaries, and one of them is lossy in a way that
silently corrupted the display scale. §2 gives Display as
`clamp(38px,5–7.2vw,98px)`, but the prototype has *five* separate display
ramps — `38/5vw/58` (×2), `42/5.6vw/68`, `46/6vw/72`, `48/7vw/82`, and the hero
at `48/7.2vw/98`. Read as one token, that row pairs the smallest ramp's floor
with the largest ramp's ceiling, and no instance in the design is 38 → 98. The
hero shipped 10px below its own design for that reason. `displayText` follows
the hero's ramp; check the markup before trusting a range in the guide.

`displaySmallText` is the ramp below it — the prototype's `42/5.6vw/68` — for a
page that is display-scale but is not the front door. The 404 is the first call
site: at the hero ramp its headline took four lines in a column that shares its
row with a card, and a 404 shouting louder than the landing page has the
emphasis backwards. Reach for it before writing a one-off `font-size`.

One deliberate departure, recorded here rather than silently absorbed:

| Mixin | Spec | Here | Why |
|---|---|---|---|
| `eyebrowText` | `10–14px` | `12–14px` | The same section states "Never below 12px". The table and the prose contradict each other; the prose is stricter and matches this file's contract. |

`eyebrowText` applies `text-transform`, so the string in the `.tsx` stays
sentence case and readable.

Two mixins there are not about size. `tabularFigures()` lines digits up in a
column, and `srOnly()` is text for assistive tech only — four modules had
hand-written copies of that clip-rect block before it was a mixin, and
`display: none` would take every one of them out of the tree they exist to
be in.

### Elevation — `theme/_elevation.scss`

Shadows named for the surface they lift, because they aren't a ramp:
`$shadow-popover`, `$shadow-toolbox`, `$shadow-snackbar`, `$shadow-modal`
(purple glow), `$shadow-modal-error` (destructive swap), `$shadow-winner`.
Plus `focusRing()`, `hairline($side)`, `backdrop()`, `screenGlow()`, and the
full z-index ladder (`$z-rail` 40 → `$z-snackbar` 95) so a new overlay is
placed by reading the ladder, not by guessing a bigger number.

`screenGlow()` is the accent bloom the big screens sit under — both lobbies,
the reveal, the podium and the tiebreak. A mixin rather than five copies
because two things about it are easy to get wrong in a copy, and both had
been: it needs `isolation` on the element carrying it, or the `z-index: -1`
circle escapes to the root stacking context and the canvas background paints
over it; and its width has to be `min($width, 100%)` of the column, because
`radial-gradient(circle, …)` sizes to `farthest-corner` and is therefore still
lit at its own edge. The caller keeps `overflow`, because the answer differs —
every caller wants `overflow-x: clip`, and a box that starts below the header
wants `overflow-y: visible` so `AppHeader` covers the cut instead of a hard
line landing mid-page.

### Motion — `theme/_motion.scss`

One mixin per animation — `popKeyframes()`, `pulseKeyframes()`,
`riseKeyframes()`, `caretKeyframes()`, `toastinKeyframes()`,
`genieKeyframes()`, `spinKeyframes()` — included by the module that uses it. The spec requires
these live in a stylesheet, never driven inline from JS.

**Include them per module, not once globally.** A `.module.scss` has its
`animation-name` rewritten to the module's scope exactly as its class names
are, so a rule naming a keyframe declared in a *global* stylesheet asks for
`Snackbar-module__hash__toastin` — which nothing declares, and the element
simply renders in its static state. That is what left the reaction floaters
sitting motionless along the bottom of the room, and it was quietly true of
`pop`, `pulse`, `caret` and `toastin` as well. See
[ADR 0013](./adr/0013-a-keyframe-is-scoped-to-the-module-that-names-it.md).

### Breakpoints — `theme/_breakpoints.scss`

`t.mq('sm' | 'md' | 'lg' | 'xl')` → 480 / 768 / 1024 / 1280px, **min-width only**.

**When the window is the wrong thing to measure, use a container query.** The
room docks a 360px chat rail beside the content, so the same window is a
comfortable two-column lobby with chat shut and a cramped one with chat open —
and `t.mq()` cannot tell the two apart. `LobbyScreen` sets
`container-type: inline-size` on its root and layers its second column on at
`@container (min-width: t.$lobby-columns)`. Same min-width direction as
`t.mq()`, and the same rule applies: write the narrow layout unconditionally,
then add to it. Reach for this only when the rail's width is genuinely part of
the answer; `t.mq()` remains the default.

**Every threshold is a named token**, in `theme/_metrics.scss` under *Column
measures*, and each one states the widths it sums. The room's screens are all
container-keyed now — `VoteScreen`'s sticky lock dock was the last `t.mq('md')`
among them, and it was wrong in exactly the band the rule exists for: at a
768–1000px window with chat docked it unpinned the button while the column
underneath was still phone-shaped.

Two of them measure a *component* rather than a screen, because
`PromptBanner` is drawn in four different columns and the window is the measure
of none of them: `$prompt-banner-columns` is where its 186px author block
earns a place beside the quote instead of above it, and
`$prompt-banner-roomy` is where it can afford the padding the design draws. A
phone gives that banner 289px — `RoomShell` spends the rest on screen padding
and the corner the floating keys own — and `e2e/responsive.spec.ts` holds
running text to 260 of it, so the designed 52px of side padding is 23px more
than the component has to give.

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
9. **Inside the room, the window is the wrong measure.** `t.mq()` asks the
   viewport, and the room's content column is the viewport minus a docked
   360px chat rail — so a `md` query put two-column layouts into 288px of
   space. Anything that reflows inside that column asks its own width instead:
   a `@container` query against a `container-type: inline-size` wrapper, with
   the threshold named in `theme/_metrics.scss` (see **Column measures**).
   `t.mq()` is still right for the chrome the window genuinely describes — the
   header, the rail's own dock, the front doors.

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

**Layout primitives**

| Component | Tier | Use when |
| --- | --- | --- |
| `Stack` | atom | Vertical layout. The default way to space a column — `gap`, `padding`, `align`, `justify`, `as` |
| `Inline` | atom | Horizontal layout. Wraps by default; same props as `Stack` plus `wrap` |
| `Box` | atom | A surface — `padding`, `radius`, and a named `background` from the palette |
| `Grid` | atom | Two-dimensional layout. `columns` / `mdColumns` reflow at `md`; `fluid` reflows on the grid's own width, capped at `mdColumns`, with the cell minimum from `--grid-min` |

**Atoms**

| Component | Tier | Use when |
| --- | --- | --- |
| `Icon` | atom | Any glyph. Thirteen stroked paths traced from the design; `currentColor` by default. `weight` overrides a glyph's own stroke — `CloseButton` is the only caller, because an × wants more body once it is a filled key rather than a bare mark. The `toolbox` glyph is not in the design: it was traced so the room's floating controls stop opening behind the smiley, which interaction rule 4 reserves for reactions |
| `Button` | atom | Any clickable action. Variants `primary` (one per screen), `secondary`, `outline`, `destructive`, `ghost`; sizes `inline`, `text` (no horizontal padding, for a label that has to share an edge with the column it sits in), `small` (share pills), `form` (51px CTA), `toolbox`; `blocked` for "not yet, and here's why"; `href` renders it as a link when the action is really a navigation |
| `CloseButton` | atom | The one way out of anything — a filled disc with a heavier × on it. `medium` is a **36px plate inside a 44px target**: 36 because it is `$lobby-help-key`'s size and on a phone this sits directly under that key, where a 44px disc was eight pixels wider than the key above it and four further right — two round keys in a column, neither the same size nor on the same edge. The target is a `::after`, out of flow, so the touch minimum never widens the box its neighbours are laid out against. `small` is a 26px key for a row that never had 44 to give (a staged GIF, a popover title bar). Five surfaces drew their own before this: the modal, the chat sheet, the room toolbox, the GIF popover and the composer's two staged rows, every one of them a bare 2.2pt × on nothing — which is the least affordance a control can have, and no affordance at all on a phone with no hover to find it with. `label` is required and specific; only `Modal` passes a bare "Close", because the dialog names itself a line above |
| `HelpKey` | atom | The round key that opens the walkthrough — the `help` glyph on a disc. `accent` is the room's: a 36px plate sharing `CloseButton.medium`'s size and its out-of-flow 44px `::after` target, because those are the app's two round keys and a phone stacks them in a column. It is the one thing the app header's trailing slot hangs on the lobby, a screen with neither a clock nor rounds-played to report. `outline` is the landing nav's — the outline button's hairline, hover fill *and* height, drawn at the full 44 because it sits in that button's row and a plate eight pixels shorter than the pill beside it read as a decoration. Both read `$tap-target-min` for that height rather than copying a number out of the other's rendered box. The tone carries the size on purpose: matching its neighbour is the whole reason there are two — on a phone it *replaces* "How it works", which stands down there with `GitHub`. The lobby drew this inline first; the nav needing the same control is what made it an atom rather than a second copy |
| `Eyebrow` | atom | The small uppercase marker above a heading. Uppercases in CSS, so the string stays sentence case |
| `Tag` | atom | A role or ownership marker — HOST, YOU, 1st |
| `Chip` | atom | A search suggestion or filter. Reports `aria-pressed` when selected; `blocked` for "not yet, and here's why", the same contract `Button` has; `wrap` for a label that is a sentence rather than a phrase — the prompt starters are the case, and five `nowrap` pills are five full-width lines that read as a broken list. The picker's chips were `blocked`'s first case, when each one spent a search off the round's budget; that budget is gone (ADR-0026) and the prop stays as a design-system affordance — the gallery is where it is demonstrated now |
| `TimerPill` | atom | The round clock. Flips to urgent at ≤15s, or on demand for sudden death |
| `ProgressRail` | atom | The 3px rail under the header that drains with the timer. `size='bar'` is the thicker one the reconnect overlay counts down with; `tone='accent'` is the boot screen's, where the rail measures work rather than time |
| `StatusPill` | atom | A short statement of where the room is — "Locked in" over media, "4 of 7 have voted" on the canvas |
| `RankSlot` | atom | One place in a ranked ballot. Dashed when empty, gold at first, clears when tapped. A single-vote room draws one, named rather than numbered |
| `ReactionGlyph` | atom | One reaction's face — a character, a Slackmoji, or a catalog emoji, from one glyph string. The wire carries the glyph and four surfaces render it, so the branch lives here rather than four times. Also owns the animated upgrade: the still first, then Google's CDN once the tile is near the viewport and motion is welcome |
| `TallyPill` | atom | One reaction's running count. Carries its own scrim over media. Drawn at `ReactionCTA`'s 32px, because the two share a row |
| `PresencePill` | atom | "7 here" — live room presence |
| `RoundProgress` | atom | How far through the game the room is, as pips |
| `Logo` | atom | The Captionist mark, at `header` (26px), `landing` (34px) or `badge` (56px, the one the boot ring is drawn around). The delivered SVG verbatim, so it resolves at any size. Its `rx=60` ground carries its own rounded corners — never round it again. Decorative: every call site sits it beside the wordmark, or inside a `ProgressRing` |
| `Avatar` / `AvatarOverflow` | atom | A player, at one of eight sizes. Art from a seed, a resolved `src`, or the initial when there is neither. `hat` perches a token's art over the circle from 34px up — the clip lives on an inner `.clip` so the rim is no longer what decides whether a hat may sit above it. `decorative` drops it out of the accessibility tree, for when a parent already names the player |
| `TextField` | atom | Every text input — `caption` (62px), `search` (52), `composer` (46), `popover` (34) |
| `Toggle` | atom | A room setting, on or off. Controlled |
| `Stepper` | atom | A bounded numeric setting — timer, room size, round count. Renders as a spinbutton so the value and its bounds are announced together. `blocked` is the setting not applying at all — a round timer in a lobby is a clock reading 0:00 with two keys that adjust nothing — and, like `Button`'s, it is a tint and not a `disabled` or `aria-disabled` attribute; what a held-back control owes a reader is the *reason*, which is adjacent text. `/host` stacks the round stepper with a hint line, because its `max` moves with the room size and a bound that silently refuses reads as broken |
| `SegmentedControl` | atom | A small exclusive choice. A real radiogroup. `fullWidth` splits the row evenly where the control owns it — the lobby's mode toggle, which is also what lets two long option labels stay whole on a phone |
| `Snackbar` | atom | Confirms an action with no other visible result. `tone='warning'` is the room saying **no** — a refusal off `useRoomRefusal`, which used to arrive on the same dock wearing the same green tick as "Room link copied", so "Need 2 more players." was presented as a thing that worked. Yellow rather than red: red here is destructive (*Force a tie*, *Restart game*) and a refusal is neither destructive nor an error. Announced assertively, where a confirmation is polite |
| `ReactionCTA` | atom | The one affordance that opens the reaction toolbar. Never a bare `+`. Appears on all five sites the design names — caption cards, chat messages, the composer, the room toolbox and the reveal bar. The fifth was the collapsed rail until the room's reaction picker moved inside `RoomToolbox`, so that surface holds it rather than competing with it. Takes an `aria-label` override, so a log of twenty messages does not hand a screen reader twenty controls called "Add a reaction" |
| `RoomCode` | atom | A room code, for reading aloud or typing. `display` on the entry screen, `compact` beside the lobby's QR, `pill` inline beside its own label on the boot screen — where the code is being identified rather than read out, so it sits at label weight instead of owning the card — where it is `white-space: nowrap`, because a code is read out and typed by hand and `C-D77KR` above a lone `T` is one somebody will get wrong. The column gives instead: `$lobby-share-width` is sized around it |
| `ProgressRing` | atom | An indeterminate arc spinning around whatever it wraps — the guest's face, the app's mark, or nothing at `inline` size in a checklist row. Deliberately not a prop on `Avatar`: the host's boot rings the mark rather than a face, so a ring that could only wrap an avatar would be half a component. `still` closes the loop and stops it, for a step that is done |

**Molecules**

| Component | Tier | Use when |
| --- | --- | --- |
| `WaitingDots` | atom | Three dots breathing above a headline — the room is doing something you are not waiting on a number for. Not `ProgressRing` (one task in flight, spinning around something) and not `RoundProgress` (pips that count rounds); this one measures nothing. The stagger *is* the design's static full/55%/25% ramp, animated; reduced motion gets the ramp back as a still |
| `JoinPanel` | molecule | A room's code and QR on their own, for a screen shared to a wall. **No caller today** — `/join` is built from `CodeEntry` + `AvatarPicker`, and the lobby's own share block is `RoomShare` |
| `PromptBanner` | molecule | React mode's stand-in for the shared image. Always its own full-width line. Reflows on **its own** width (`$prompt-banner-columns`, `$prompt-banner-roomy`) because it is drawn in four different columns: the author block is a measured 186px that does not shrink, so under the measure it stacks above the quote instead of squeezing it, and tightens its padding — a phone gives it 289px and the sweep holds running text to 260 of that |
| `PlayerRow` | molecule | One player in a list — `roster`, `tracker`, `standing` or `pill`. The guest lobby's `pill` draws its avatar at 34px rather than the design's 30, because 30 is under `HAT_MIN_SIZE` and "who else is here" is the question a hat answers |
| `MediaCard` | molecule | One entry in a vote grid. Six states, both modes. Drawn at its image's own ratio, with caption overlays sized against the card and stepped down a size per line they need. Its foot takes `caption`, `reply`, `reaction` and `action` as peers; `onActivate` makes the picture itself a pointer target for whatever `action` does |
| `ChatMessage` | molecule | One chat message in three bands: a **name row**, a **bubble** carrying body, quote and attachment together, and a **reaction row** under it. The bubble is `fit-content`, so four words read as four words rather than as a plate with 200px of nothing after them, and the avatar drops to the bubble's top edge — the face belongs to what was said, the name is the label on it. `onReact` puts the CTA at the end of the reaction row, **always lit**: under the plate it is out of the reading path, which is what lets it stay visible, and a hover-only affordance is no affordance on a phone. A room announcement is the same component with `announcement` — its own accent plate, taking the avatar gutter too. It is set by the **host engine**, never by a tap: a mode switch, a player dropping, a player coming back ([ADR 0028](adr/0028-the-room-speaks-in-its-own-lane.md)). It is drawn with `ROOM_FACE` rather than a person's props, and the eyebrow is the speaker's name alone — the old `· host` suffix came from `author.isHost`, which made every line the host typed a card signed "HOST · HOST", and since that branch drew only the body a GIF from the host was an empty one. The host is a player, so their chat is chat. An attachment is bounded by 180×120 rather than forced to it, so a Slackmoji posted from the composer stays its own size |
| `UnreadDivider` | molecule | Where you stopped reading |
| `ReactionToolbar` | molecule | The searchable reaction picker. Controlled by `open` so it can animate out, dismissed by Escape or a click anywhere outside it, and genie-in/out from the edge its `flipped` anchor sits on. No printed title — the thing you opened it from already said what it is for. Six emoji and four Slackmojis by default, then five pack tabs in a row that scrolls sideways, then keyword search across all 616. Packs render 60 at a time and extend on scroll |
| `RoundOpener` | molecule | The interstitial before each round |
| `Modal` | molecule | The multi-step card — or a single-step announcement, which hides the step counter rather than reading "Step 1 of 1" (the podium's "Nobody paid the GIF bill" is one). 880px and one fixed height at every step, so it does not resize under a Next click. Its rail is a `ReactNode`, not a `src` — full-bleed, 380px beside the copy above `md` and a band above it on a phone, so Back and Next stay last. Three ways out — the close key, Escape, and a click on the backdrop, which ignores a selection drag that merely ended out there. A step's `body` is a `ReactNode`, not a string: the licensing walkthrough cites four licences and a repository, and a licence you cannot open is a licence nobody read |
| `HelpModal` | molecule | "How Captionist works", wherever it opens from: the landing nav, the host's setup screen, the lobby's help key, the room toolbox. Four steps per format, and a switcher that reads the other format without changing the room — the room's own mode is only the starting point and the green dot. Its rail carries a miniature of the screen each step describes (Screens 2e–2h): the picked image wearing its Selected pill, that same image being captioned, a vote grid mid-ranking, then the champion. **The pictures arrive on a television**, not into a hole: `TvStatic` while the lookup is out, `TunedImage` once a URL exists and the bytes are still coming, and the committed SVG only where the lookup settled on nothing (stubbed, keyless, the suite). Caption step 2 draws both meme lines and no composer under them — the field was a third copy of the bottom line over a clock nothing in that step counts. **Step 3's rail is the one that is not the same in both formats** — the words are, but caption mode ranks four captions over *one* image and react mode ranks four different GIFs, so `VoteIllustration` takes the mode. Four pictures in caption mode taught the other format to the person who opened the walkthrough to learn this one. A value branch inside one component, never a second component. The pictures inside them are **real GIFs**, curated by slug in `lib/gifs/art.ts` and resolved in the browser like the landing wall — they were house SVGs with an emoji in the middle, which is the wrong thing to show somebody reading a walkthrough of a game about GIFs. The committed SVG is still what paints first and what a keyless clone keeps |
| `RoomToolbox` | molecule | The room's floating controls, fixed bottom-right, collapsing to a FAB. **`host.available` says which of the host's controls apply**, from `hostControls(state)`: the engine allows every one of them in every phase and quietly no-ops most outside a running round, so a lobby had a *Pause* key for a clock reading 0:00, a *Skip ahead* for a room nobody had started and a *Force a tie* with nothing to tie. Blocked, never disabled — and per ADR 0032 the labels stay the verb, with one `note` line carrying the reason for the whole group rather than six labels narrating it. Opening unfolds the panel out of the key it replaced — `transform-origin` at the bottom-right corner where the FAB was standing a frame ago, so it reads as the key opening rather than a card appearing over the room — with the head and the body arriving a beat behind the plate. Transform and opacity only: this sits over a screen that may be running twenty GIFs. Everyone gets one: the "React to the room" row and the walkthrough for all, the host's controls as an extra section behind a `host` prop. Dismissed by a click outside it, or by Escape — which closes the inner picker first, so one keypress cannot collapse the bar out from under it |
| `ChatRail` | molecule | Room chat: docked beside content above `md`, a sheet over it below. Collapses to a 64px strip, or one floating key on a phone. Both sizes are one component and the branch is entirely CSS. The strip carries no reaction key — reacting to the room is a `RoomToolbox` tool, not a chat one. **Chat slides in and out at both sizes** — up from the bottom edge on a phone, in from the right on a desk, each matching the edge it docks against — `useExitDelay` holds it past `open` so there is something left to animate; while it leaves it is `inert`, so a panel halfway off the screen is neither tabbable nor a second "Room chat" in the accessibility tree. Above `md` the leaving copy also leaves the flow, or it would stand beside the collapsed strip as a second 360px column for 200ms. **The sheet's handle is draggable**: down once shrinks it to 42% so the round is readable behind it, down again dismisses, up or a flick puts it back. It is a real button, not a bar with a listener — Enter toggles the two heights and the arrows pick one outright — and the gesture is a shortcut over controls that were already there. The docked rail never sees any of it |
| `ChatToast` | molecule | An arriving message while chat is shut. Not `Snackbar` — that one is the room's single centred voice for something *you* did and carries no author. `announcement` gives it `ChatMessage`'s accent treatment and drops the face: a collapsed rail is exactly how somebody misses a mode switch, and an avatar there would say a *person* told you |
| `Composer` | molecule | The chat composer. Sends on text *or* an attachment, and carries the staged reply above them |
| `GifPanel` | molecule | GIF search, as a `popover` above the composer or a full-page `board`. Picking attaches and, in the popover, closes; it never sends. Masonry columns, each tile at its GIF's own ratio, lazily loaded and preferring the WebP rendition — a board is fifty tiles. `onMore` adds "Shuffle results" beside the suggestion chips, which fetches the next page for the same query and wraps at the end; `provider` drives the attribution mark, which lives here rather than on each screen so a new board cannot ship without it, and never appears over the offline shelf — it also turns off local keyword narrowing, because filtering a provider's results is against their terms |
| `AdSlot` | molecule | Sponsored banners above the picker board, in a sandboxed iframe (never `allow-same-origin`). Renders nothing when no ad came back, which is the ordinary case. Never inside the masonry: an ad is a third-party HTML document with a fixed size and a 10% rescale cap, so a fluid column letterboxes it and a `<button>` tile would make it pickable. |
| `RevealReactionBar` | molecule | Five one-tap reactions on the reveal, plus the CTA to the full toolbar |
| `ReactionFloaters` | molecule | The decorative emoji burst. `pointer-events: none`, hidden from assistive tech. Renders through `ReactionGlyph`, having once printed `/media/slackmoji-lgtm.svg` up the screen in 30px text. Four to seven per reaction, 16–58px on a squared roll so most stay small and the occasional big one reads as an accent — the old 20–36 was a burst of one size with jitter. Keyed on the burst's `key`, never on the prop object, or a clock tick re-fires it |
| `AppHeader` | molecule | The bar on every in-room screen — phase left, clock right. The settings line is drawn only from `md` up: in a round the phase takes a phone's width, and in the lobby the name, the host chip and the walkthrough key do, with the rules reading off the share card instead. `trailing` carries the pips, the clock, or the lobby's walkthrough key — no two are ever wanted at once |
| `CodeEntry` | molecule | Typing a room code on `/join`, where it is the whole screen. Seven thumb-sized slots, one real input behind them |
| `QuickJoin` | molecule | Typing a room code on the landing page, where it sits beside a headline on glass. One masked field, `C-______`, with an inline key — not `CodeEntry` at another size |
| `RoomShare` | molecule | The lobby share block — QR, code, copy and share. The second key opens the **OS share sheet** where there is one and copies where there is not (`useWebShare`), so its label is the caller's: "Share link" on a phone, "Share to Slack" on a laptop where the clipboard really is how a link reaches Slack. A sheet that opened raises no snackbar — the sheet is the visible result — and a cancelled one raises nothing either, because that was a decision rather than a failure. Grid areas rather than a flex reflow, because the QR spans both rows on a desk and the actions move from under the code to under the whole block on a phone. `meta` is the room's rules under the link, drawn only below `md`, where the header has no width for them |
| `LandingNav` | molecule | The public front door's bar. Not `AppHeader` — that one is live room state, this is static links and a way in |
| `LicenseModal` | molecule | "What this is built on" — the four licences a production deploy carries: MIT for the app, the GIF providers' terms, CC0 for the faces, CC BY for the reaction art and OFL for the type. A configured `Modal` like `HelpModal`, four steps rather than one wall of text, because the card is a fixed height and these are genuinely four obligations to four parties. Kept by hand, not generated from `package.json`: what carries a condition is the *assets*, and a dependency list buries those under sixty MIT runtimes that ask for nothing |
| `LandingLegal` | molecule | The landing page's foot — one link, to the licences. It exists so `app/page.tsx` can stay a Server Component: the `'use client'` boundary is this line and nothing above it. Not in `LandingNav`, whose third item is the way in and should not compete with "Licensing"; and it carries no repository link of its own, because the nav's "GitHub" already goes there and two links to one destination on one screen is a reader wondering what the difference is |
| `HeroWall` | molecule | A tilted wall of looping GIFs — the landing hero's background, and the 60% beside `/host`'s form. Video over GIF, still-first, and stoppable. `scrim` picks the veil's weight: `full` for a wall carrying display type, `soft` for one carrying nothing |
| `Podium` | molecule | The final three. Winner centred visually, 1-2-3 in the DOM |
| `CycleWall` | molecule | Four frames in a row, each dissolving through four GIFs — the waiting screen's answer to dead time, and the design's own note on artboard 1h is the brief: anticipation rather than an empty spinner. **The cross-fade is CSS**: every layer runs one animation at one duration, offset by an even fraction of it, so the browser owns the schedule and no second clock ticks on a screen that deliberately runs one. Resolves `WALL_SLUGS`, so it shares the landing wall's lookup and a ten-round room pays for it once. Frames are sized in CSS rather than by their contents, so the row is the same shape before, during and after the art arrives; with none it is four veiled dead channels, one layer each — a tuning frame is one state, not four. Prefers MP4 over GIF and holds ADR 0005's contract, like `HeroWall`, which it is deliberately not: that is twenty static tiles behind a whole page |
| `UpNext` | molecule | "Up next after Vic" — who takes the role next, as a pill with their faces overlapping in the order they will take it. Reads `upNextRoleHolders`, which is `roleHolderIndex` modulo a roster kept in join order and **capped by the rounds actually left**, so a room on its last round renders nothing rather than promising two more turns. Its note is not the design's: the artboard says "order is randomised each round" and the rotation is fixed, so it says the true thing. One `role="img"` for the row rather than a label per face — three announced avatars is three stops past what is, to a reader, one fact |
| `SceneBackdrop` | molecule | **No caller as of this change** — kept, not deleted, but nothing renders it. Media behind a whole screen rather than inside a card: fixed, inert and `aria-hidden`, with a scrim in two weights, television static while its clip is fetched and nothing once the lookup settles on nothing. It was the waiting faces' answer to an avatar and a headline alone on the canvas; that screen has `CycleWall` on it now, and a veiled full-bleed clip behind the words was the same idea drawn worse. Still carries [ADR 0005](./adr/0005-media-that-can-move-ships-a-still.md)'s contract, including the fix that made it keep it — the play effect takes the clip's URL as a dependency, because the `<video>` mounts a beat after the motion preference settles and without it the clip sat on its poster forever |
| `TvStatic` | atom | A set tuned to a channel that is not there. The placeholder for media still being fetched — one behind the waiting screen, twenty across the landing wall. Server-rendered: an inline SVG and CSS, so it needs no script, no request and no decode. `seed` desynchronises each set; `paused` holds one still, and `prefers-reduced-motion` holds all of them. |
| `TunedImage` | molecule | An image with a set behind it. `TvStatic` while the picture is on its way, the picture over it, and the static **dropped on load rather than covered** — `MediaCard` draws an unselected image at 85%, and a field repainting five times every 200ms under fifty loaded GIFs is a bill for something nobody can see. Never dropped on error, so a pulled GIF or a dead CDN keeps its dead channel. `tuning={false}` for a card with no media at all, which is a settled nothing rather than a wait. Veiled with `$scrim-static`, like every other set in the app. `'use client'` for one boolean, so `MediaCard` stays a server component. The wrapper declares **no width** — it fills a block container and shrink-wraps a fixed thumb, so one component serves the picker's fluid column and the chat quote's 30px square alike |
| `HatPicker` | molecule | Choosing a hat on `/join` and `/host`. Sixteen plus a "No hat" tile, folded to six behind a "Show all hats" disclosure because it is the *second* picker on that card. Built to `AvatarPicker`'s shape — a real radiogroup, roving tabindex, arrows that move the selection with the focus — and names what is worn in the header slot where the face picker puts its shuffle. `heading` draws the label as a section head, which `/host` uses and `/join` does not |
| `AvatarPicker` | molecule | Choosing a face on `/join` and `/host`. Offers a window of ten from the seventy-seed catalogue — one line inside a container wide enough, five and five on a phone — with a "Shuffle faces" that re-rolls the offer and keeps your pick. A real radiogroup with roving tabindex and arrow keys. Owns the seed-to-preview-colour mapping so two screens cannot drift |
| `ModeCard` | molecule | One of the two game modes, as a card with the sentence that explains it — a format, not a setting |
| `ReconnectOverlay` | molecule | The room is still there; you are not attached to it. Red rather than purple, over the blurred room rather than instead of it. **Not in this gallery** — it is `position: fixed` with no dismiss, so it would cover the page; `e2e/reconnect.spec.ts` covers it against a real room |
| `Wordmark` | molecule | The mark and the name together, at `header` or `landing`. Extracted when the boot screen would have been the third inline copy of a lockup `AppHeader` and `LandingNav` each carried their own. The name is real text, not artwork — it is the only place the app says what it is called. `showName` draws it on a phone too, for the one bar with room: the lobby's, which carries no phase and no clock. A molecule rather than an atom because it imports `Logo`, and the tier is a dependency fact |
| `BootChecklist` | molecule | The steps a room takes to open, and which one it is on. Four states per row — `pending`, `active` (a plate and the weight, so a glance finds it), `done`, `failed` — each named in words for assistive tech as well as drawn. Not `StatusPill`, which carries a sentence about the room to everyone in it; this is a private list whose order is the meaning, so it is a real `<ol>` |

**Organisms**

| Component | Tier | Use when |
| --- | --- | --- |
| `ComponentGallery` | organism | The review surface at `/components` — every component in its states, **under `next dev` only**. Five tabs, one panel mounted at a time: the three tiers `components/README.md` defines, then Assets (faces, hats, reactions, the offline shelf, the mark — each read from the module the room reads, never a copy) and Tokens (the spacing scale and the radii, drawn from the published custom properties). `sections.ts` is the one table the tab bar, the jump rail and the deep link share, so `/components#media` opens Molecules and scrolls to it |
| `RoomShell` | organism | The chrome around every in-room screen — header, clock, rail, host toolbox, snackbar |
| `RoomBootScreen` | organism | The screen a room opens behind, host or guest. One `variant` branching values — copy, badge, and where Cancel goes — never a forked sibling. Replaced a bare "Joining the room…" paragraph that served both roles identically and offered no way out. Every checklist row is a milestone that actually resolves; the two rows the mockups drew over work the app does not do were relabelled onto the real sequence rather than the work being faked to match |
| `ChatPanel` | organism | The message list and composer inside the rail. An organism because it composes four molecules and reads the room; `ChatRail` is only the container and has no idea what a message is. Its reaction surface carries *what it is aimed at* — a message you picked, or the room when there is none |
| `LobbyScreen` | organism | The room before it starts: share block, roster, and the one button. Two layouts by role (host/guest) and, within the host's, two by width — a phone's order is share card → mode → blurb → roster → sticky start bar, a desk's is the design's two columns. The one screen in the app where the phone and the desk are laid out differently rather than reflowed |
| `BriefScreen` | organism | Setting the round up, and watching someone else do it — all four `viewKey` faces |
| `ComposeScreen` | organism | Captioning an image, answering a prompt, or sitting the round out |
| `RoundPicker` | organism | The GIF board a round is searched on, in **both** modes — the Captionist picking the image, everyone else answering the Prompter's line. Field, suggestion chips, shuffle and "Surprise me" under it, the board, and — across the foot, sticky — the one control that commits, once. What differs is the `headline`, the `note`, and `above` — the eyebrow that says whose turn it is, or the `PromptBanner` you are answering, which leads the screen rather than being pinned over the board. Not `GifPanel`: that is the field and the grid, and it is also the composer's popover; this is the round around it. The search and the staged tile stay with the screen above, because `useGifSearch` fetches per face and the brief's clock reads what you staged. An organism for one reason — it says "Picked one for you" through `useRoomShell`, so both modes say it once |
| `WaitingScreen` | organism | Your entry is locked and the room is not — your card, and who everyone is still on |
| `VoteScreen` | organism | Ranking the room's entries. The ranking is local until you lock it |
| `TiebreakScreen` | organism | Sudden death. The one pre-reveal screen that names people |
| `RevealScreen` | organism | Where anonymity ends: the winner, the runners-up, and a reaction |
| `ScoreScreen` | organism | Standings between rounds, and the advance that starts the next one |
| `PodiumScreen` | organism | The champion, the final three, and the two ways on |
| `JoinScreen` | organism | Entering somebody else's room: the code, a face and a name, before a seat is asked for |
| `HostSetupScreen` | organism | The only screen where a room's rules are set — and its defaults are playable untouched. One column below `xl`, a 40/60 form-and-wall split above it, with the CTA docked to the form column in both |
| `LandingActions` | organism | The two ways into a room, side by side — start one, or type a code. Routes, which is what puts it at this tier |

An organism is anything that calls `useRoom()` — that is what puts these here
rather than in `molecules/`. `RoomShell` owns everything outside the content
column; a screen owns its column and nothing else, which is what stops ten
screens each growing a header.

Every component the design library specifies is built, and **every room phase
now has a screen** — which is what retired `PhasePending`, the stand-in that
covered the six unbuilt ones. See
[architecture.md](./architecture.md#not-yet-built) for how the design's 16 state
branches normalise to 10 phases, and [the roadmap](./roadmap.md#phases) for the
order they arrive in.

---

## 4. Interaction rules

From `DESIGNSYSTEM.md` §4. These are product rules, not suggestions.

1. **One primary action per screen** — the one that advances the phase.
2. **Every invisible action confirms** with a snackbar (copy link, share, mode
   switch).
3. **One overlay surface at a time** — opening one picker closes the others.
4. **Reaction affordances are uniform** — smiley-plus icon, searchable toolbar,
   everywhere. Never a bare `+`.
5. **Anonymity until reveal** — no author names on vote cards in either mode.
6. **Timers are honest** — phases auto-advance at zero; ≤15s turns the pill red.
7. **Blocked, not disabled** — state what's missing in the label ("Pick 2 more"),
   keep the control live and focusable. That's what `Button`'s `blocked` prop is.
   The label carries a *count the screen does not already show*; where the only
   thing missing is that you have not started, it stays the action — see
   [ADR 0032](./adr/0032-a-blocked-label-counts-what-is-missing.md).
8. **Chat is never modal** — it docks beside content, never over it.
9. **Mode is always legible** — header settings line, round opener, help modal.

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
3. **Blocked buttons say what's missing**, in the label — when the screen does
   not already say it. An empty field above an untouched button says it; a
   remaining count does not. [ADR 0032](./adr/0032-a-blocked-label-counts-what-is-missing.md).
4. **Headings are six words or fewer** on mobile.
5. **Errors state what happened and what to do next**, in that order. Never a
   bare "Something went wrong", never a raw error code as the whole message.
6. **Say "you", not "the player".** Avoid "please".
7. **No undefined jargon.** Game-specific terms go in the glossary below.
8. **Numbers and codes are formatted for reading**: room codes tracked and
   tabular, timestamps relative ("2 minutes ago") in live views.

### Where the copy deliberately departs from the design

Two strings do not match `design/`, and both are deliberate. Recorded here so
the next person reads this rather than "fixing" them back.

| What the design says | What we ship | Why |
| --- | --- | --- |
| Compose: submitting leaves you on the composer, *"You can swap it until the clock runs out."* | Submitting hands you the waiting face, and there is no swap. The copy says *"You get one shot"* on the way in | A product call, not a layout one: a caption you can keep rewriting until the clock dies is a different game from one where the joke you commit to is the joke you are judged on — losing a round to a line you sent too fast is the fun. It also fixed a real read: the old screen answered a submit with a snackbar and an open field, which looks like nothing happened. The phase is still room-wide; `submitted` is its per-viewer face, exactly as `pickwait` is `brief`'s, and the reducer still upserts on author so a resent message cannot give one player two entries. |
| Waiting: *"You can still edit until the clock hits zero…"*, with an "Edit my caption" / "Swap my GIF" button | *"It goes up anonymously when the clock hits zero, and the roasting begins."*, with no edit | Phase is room-wide and authoritative, so a guest cannot rewind the room to `compose`. An inline editor here would be a second composer to hold in step with the real one. The copy had to stop promising the button. |
| Waiting: one screen, one headline, and a host button reading *"Everyone's in — start voting"* | Two faces off the tracker. Everyone in: *"That's everyone in."*, a three-second beat instead of twelve, and **no button**. Somebody still out: *"Now we wait."*, the full twelve, and a button that names them — *"Start voting without Jack"*, or *"Start voting without 2 players"* | The button was never a gate: `waiting` is timed, and `host/skippedPhase` runs the same `advance()` the clock does. So once the last entry landed — which is *what flips the phase* — the room said "now we wait" over a tracker reading N of N, under a twelve-second clock, beside a button offering to start a vote that was starting anyway. Four announcements of one finished fact, and a decision put to the host that they had no information to make. The wait now reads the tracker: `WAITING_ALL_IN_MS` when there is nobody in it, the full `PHASE_DURATIONS.waiting` when there is. The label had a second problem of its own — `waiting` is reachable with stragglers, because the *compose* clock expiring sends the room there whoever is still typing, so the host was told everyone was in by a button sitting directly under a tracker saying they were not. Timers are honest; so are the buttons beside them. |
| Submission tracker: `submitted` / `typing…` / `still thinking` | `submitted` / `still thinking` / `left` | `typing…` needs live keystroke presence, which is the phase-6 event lane. Two honest states beat three with one of them guessed. **`left` is the third, and it is the exception that proves the rule**: it is not a guess but the one thing on that row the room knows for a fact, straight off the transport's presence set. It arrived with [ADR 0029](adr/0029-a-held-seat-does-not-hold-the-round.md), because a row reading "still thinking" over a closed tab was itself the guess — and because the count above it now excludes them, so a tracker of four over a line reading "3 of 3" needs the fourth row to say why. |

| Six faces on `/join` (seven on `/host`) in one fixed row, no shuffle — and "Shuffle" as trailing text inside the host's nickname field | A window of **ten** drawn from a **seventy**-seed catalogue, laid out **five and five**, with a **"Shuffle faces"** button in the picker's own header, on both screens | Seven faces is a set a room of up to twenty exhausts immediately, and two people wearing the same one is the game's own joke turned against it. A catalogue only works if you can re-roll what is on offer, so the control belongs beside the faces it re-rolls. It is not in the nickname field because the design's placement there reads as a *nickname* generator — which is a thing we have never built, and now visibly have not. The window was eight and is ten, and the design's single row survives it: ten tiles at 46px with an 8px gap need 532px, and the card's inner width is 548px. The row is a grid asking a **container query**, not a breakpoint — whether ten fit is a question about the card, whose width does not track the viewport — so it is one line on both front doors at every width they are drawn at and five-and-five on a phone. Getting there meant fixing the column: the form half was `40fr`, which rendered the design's 600px card at 472px at 1280, and a fraction that squeezes the one width the design actually states is the bug rather than the picker. Positions 7–9 repeat positions 0–2's preview colours, because the palette is seven — and the colour was always a preview, not a promise. |
| Join: a 600px card centred on the canvas, with "Join the room" and "Make your own" as the card's last two rows | The same 600px card, but on `/host`'s surface — docked actions, and from `xl` a `HeroWall` in the 60% beside it | The design draws join at 390 and at 1440 as the same centred column, which at 1440 is three fields and two thirds of an empty window. `/host` already answered that question, and these are the two halves of one handshake: a host reads a code out, a guest types it in. Giving join a second answer would be two front doors that share their molecules and share nothing else. Both actions dock rather than only the primary, because a guest who arrived before the host did needs "Make your own" as badly as the button they cannot press yet. |
| Guest lobby: the glow, the card and the status pill at fixed pixel sizes on a 1440 artboard | The same, but the glow is `min(900px, 100%)` of the column it is clipped by | The artboard has no phone twin for this screen, and the design's own 900px circle clipped inside a 353px column is a lit rectangle, not a glow — `radial-gradient(circle, …)` sizes to `farthest-corner`, so its `68%` stop lands about 96% of the way to the side and there is nothing left to fade. Tying the circle to the column keeps the drawing at 1440 and gives a phone the same shape at its own size. |
| Reconnect: `Reconnecting… attempt 3` | `Reconnecting…` | The transport retries internally and reports no count. A number here would be one the screen invented from a timer — the same reason the reveal's `auto-advancing in 6s` was dropped. |
| Reconnect: the 60-second countdown, always | Only when a seat is genuinely held | A seat is held by the *host*. When the host is what vanished there is no grace window, so the bar and the countdown are absent and the body says "Nothing is lost" instead of promising a deadline nobody is keeping. |

**The Slackmoji tiles are ours, and they are SVG.** DESIGNSYSTEM §4.4 draws the
picker's four non-emoji defaults as animated Slackmoji GIFs. Phase 6 left them
out on the grounds that Slackmoji are a workspace's own uploads and this app has
no storage target — but that borrowed a blocker belonging to *user uploads*,
which these are not (see [ADR 0014](./adr/0014-uploads-are-not-a-feature.md)),
and the design's own
2b heading reads `SLACKMOJIS · SHIPS WITH CAPTIONIST`. So phase 7 drew four
(`public/media/slackmoji-*.svg`), in the same authored-SVG style as the 26
offline sample GIFs, and the deviation left is medium rather than content: SVG
with a CSS animation, not a GIF.

**The picker's default view follows §4.4, not Screens 2b.** §4.4 says the
unsearched grid is "6 emoji + 4 Slackmoji GIFs"; 2b draws the same picker with
the *Slackmojis* tab selected. Those are two different views, and the system
spec wins over one instance of it — so the default tab is the mixed ten, and a
pack is something you choose. Recorded here so it is not re-litigated.

Three more designed elements are drawn but not built, and are listed with the
rest of the gap in [architecture.md](./architecture.md#not-yet-built): the
reveal's `auto-advancing in 6s` label (reveal is untimed — a label with no timer
behind it would break "timers are honest"), the podium's awards row and its
`Download the highlight reel` / `Post to Slack` buttons, and per-card reactions
on the vote grid.

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
- **A control's hit area is at least 44px, even when the control is not.**
  DESIGNSYSTEM.md draws several below the floor deliberately — the reaction CTA
  is a 28–34px pill, a picker tile 36–42px — and the design decides how big a
  thing *looks*. `@include t.tapTarget;` separates the two: the control keeps
  its drawn size and a centred pseudo-element gives the finger its 44px.
- **Never apply `tapTarget` inside a dense row or grid.** Two grown areas that
  overlap steal each other's taps, which is worse than the small target it set
  out to fix — where the design packs controls tightly, the spacing has to grow
  first. `e2e/targets.spec.ts` measures the real hit areas on a phone and fails
  on any overlap; it is the load-bearing half of this rule. It ignores a
  control that is **completely behind painted ground**: the vote screen's lock
  dock is `position: sticky` with a real background rather than a fade, so a
  phone voter always has some card's foot row buried under it — and a buried
  row is not offered to anybody, it appears when you scroll. It also ignores an
  **empty** `aria-hidden` button — those are backdrops rather than controls: a
  pointer affordance laid over content, out of the accessibility tree, exactly
  the size of what it covers, and never the only way to its action, which is
  what `MediaCard`'s `onActivate` makes of a vote card's picture. A separate
  test pins each of those to its own frame within a pixel, so one cannot grow
  past its picture and take a neighbour's tap. Two controls the viewer can
  *see*, one silently taking the other's tap, is the thing that fails. What
  that costs — content under a sticky surface is out of scope now, permanently
  — is [ADR 0017](./adr/0017-a-buried-control-is-not-a-stolen-tap.md).

Applied so far to the vote card's foot row (the reply key and the reaction CTA).
Still below the floor and knowingly so: the composer's six one-tap keys and its
GIF key, the picker's tiles and pack tabs, and the reveal bar's five — all of
them sit in rows too tight to grow without overlapping. Widening those means
changing the spacing the design specifies, which is a design decision rather
than a CSS one.
