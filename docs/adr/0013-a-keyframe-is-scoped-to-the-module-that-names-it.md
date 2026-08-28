# 0013 — A keyframe is scoped to the module that names it

**Status:** accepted · 2026-08-28

## Context

DESIGNSYSTEM.md §2 gives five animations by name — `pop`, `pulse`, `rise`,
`caret`, `toastin` — and requires that they live in a stylesheet rather than
being driven inline from JS. `theme/_motion.scss` did exactly that: one
`keyframes()` mixin holding all five, included once at the top level of
`app/tokens.scss`, which is a global stylesheet and not a module. Nine
components then wrote `animation: pop 340ms ease` in their own
`.module.scss` and referenced them by name.

None of them ran.

CSS Modules rewrite the *value* of an `animation` / `animation-name`
declaration into the module's own scope, exactly as they rewrite a class
selector. So `.headline { animation: pop 340ms }` inside
`RoundOpener.module.scss` compiles to

```css
.RoundOpener-module__67TSBa__headline { animation: .34s RoundOpener-module__67TSBa__pop }
```

while the only `@keyframes pop` in the build is the unscoped one from
`app/tokens.scss`. Nothing declares the name the rule asks for, so the browser
applies no animation and the element renders in its static state. There is no
warning: an unresolvable `animation-name` is legal CSS.

This was invisible for four of the five, because their static state is also
their end state — a headline that does not fade in is just a headline. It was
not invisible for the fifth. `ReactionFloaters` positions every floater at
`bottom: 0` and relies entirely on `rise` to carry it up the screen and fade
it out, so the room's reaction burst appeared as a row of emoji sitting
motionless along the bottom edge, forever.

Three ways out:

1. **Escape the scoping.** `animation-name: global(rise)` is the documented
   css-loader spelling. It is one word per call site, but it is a build-tool
   affordance rather than a CSS one, and Turbopack's Rust CSS-modules
   implementation is a separate codebase from the webpack loader whose syntax
   this is. Betting the room's only mandatory animation on that equivalence,
   for a framework version that postdates this repo's own docs, is a bet with
   no test behind it.
2. **Move the animated rules into a global stylesheet.** Correct, and it drags
   component styling out of the component.
3. **Emit the keyframes inside each module that uses them.** The declaration
   and the reference then land in the same scope and resolve by construction,
   whatever the bundler.

## Decision

**Each animation is a mixin, and the module that uses it includes it.**
`theme/_motion.scss` exposes `popKeyframes()`, `pulseKeyframes()`,
`riseKeyframes()`, `caretKeyframes()`, `toastinKeyframes()` and
`genieKeyframes()`; a `.module.scss` writes `@include t.popKeyframes;` under
its `@use 'theme' as t;` and then names `pop` as it always did.
`app/tokens.scss` no longer includes any of them and is back to publishing the
root custom properties, which is all a global stylesheet here is for.

The values still live in exactly one place, which is what §2's "declared once"
was protecting. What is duplicated is the emitted bytes — `pop` appears three
times in the built CSS because three modules animate with it — and at four
keyframes of two stops each that is a rounding error against five animations
that did not work.

## Consequences

- **The rule is local and greppable.** A module that animates includes its
  keyframes; one that does not, does not. There is no global declaration to
  keep in sync with the list of things that reference it, and adding an
  animation to a component cannot silently depend on somebody else's import.
- **A missing include fails visibly.** The element renders unanimated — the
  same failure as before, but now with a one-line fix in the file you are
  already looking at rather than a scoping rule two directories away.
- **`gcy` is gone.** It was a sixth keyframe in the aggregate mixin that no
  rule in the repo named, and per-module includes leave nowhere for an unused
  animation to hide.
- **Nothing may `@include t.keyframes`.** The aggregate is deleted rather than
  deprecated, so the pattern this ADR describes cannot be half-adopted.
- **The genie is the first animation designed against this.**
  `ReactionToolbar`'s open and close are declared in `genieKeyframes()` and
  included by that one module, and its direction comes from a `--genie-shift`
  custom property the anchor sets — because a custom property crosses the
  module boundary that a keyframe name does not.
