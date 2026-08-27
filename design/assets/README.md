# Artwork

Empty on purpose — the design's artwork hasn't been added yet.

The three `.dc.html` files in the parent folder reference these by relative
path, so dropping them in here (with their original filenames) is all that's
needed to make the prototypes render fully:

- `gif2-*.gif` — 32 animated GIFs
- `meme-*.png` — 5 static memes
- `avatar-*.png` — 7 player avatars
- `captionist-logo.png`, `qr.png`

Most came from Giphy. If licensing or repo size argues against committing them,
fetching at runtime is the alternative — but then these prototypes keep their
broken images, which is a fair trade for reference files nobody ships.

Artwork the *app* needs goes in `public/`, not here. This folder mirrors the
design project.
