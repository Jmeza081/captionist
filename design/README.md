# Design source

The design as delivered, unmodified. **This is the source of truth** — when
`theme/`, `docs/design-system.md` or a component disagrees with anything here,
the code is the bug.

Nothing in this folder is built, imported, or served. It's reference material,
kept in the repo so every session — and every person — is working from the same
spec rather than from a link that needs an account.

## What's here

| File | What it is |
| --- | --- |
| `DESIGNSYSTEM.md` | The authoritative guide: tokens, components, interaction rules, copy voice |
| `Captionist Prototype.dc.html` | The clickable app — both game modes, chat, reactions, overlays |
| `Captionist Screens.dc.html` | Static spec doc, three lanes: Caption / Shared / React |
| `Captionist Components.dc.html` | Component library with specs and states |
| `support.js` | The Design Components runtime the three `.dc.html` files load |
| `assets/` | Artwork the prototypes reference — **not yet added**, see below |

## Opening them

Open any `.dc.html` directly in a browser. They load `./support.js` and
`assets/*` by relative path, which is why the layout here mirrors the design
project exactly — renaming or flattening this folder breaks them.

## The missing artwork

`assets/` is empty. The prototypes reference roughly 45 files by name:

- 32 animated GIFs, `gif2-*.gif`
- 5 static memes, `meme-*.png`
- 7 avatars, `avatar-<colour>.png`
- `captionist-logo.png`, `qr.png`

Until they're added, the `.dc.html` files render with broken images — the
layout and every spec annotation still read fine, which is what they're mostly
consulted for. Most of the GIFs came from Giphy, so they may be better fetched
at runtime than committed.

The app doesn't depend on any of it: `ComponentGallery` uses inline-SVG
stand-ins (`components/organisms/ComponentGallery/placeholders.ts`), so the
gallery renders identically offline and in CI. When the real artwork lands,
app-facing copies belong in `public/`, not here — this folder stays a faithful
copy of what the designer handed over.

## Reading it as an agent

Start with `DESIGNSYSTEM.md`; it's the summary and it's authoritative on
values. Go to `Captionist Components.dc.html` for a component's exact spec and
states, and to `Captionist Screens.dc.html` for how a screen composes.

Two things in `DESIGNSYSTEM.md` describe the **prototype**, not this app, and
following them here would be wrong:

- §5's implementation conventions — inline styles only, `<sc-if>` templates,
  `DCLogic`, `renderVals()`. That's how a `.dc.html` works. This app is React,
  Sass modules and the layout primitives.
- The `assets/` paths above resolve inside this folder, not from `public/`.

Everything else — tokens, component specs, interaction rules, copy voice —
applies directly.
