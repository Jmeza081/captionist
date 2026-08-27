# Captionist — Design System Guide

Reference for building additional Captionist features. Every value here is authoritative: copy it verbatim, don't round to a 4/8px grid or substitute a library default.

Files in this project:

| File | What it is |
|---|---|
| `Captionist Prototype.dc.html` | The clickable app — both game modes, chat, reactions, overlays |
| `Captionist Screens.dc.html` | Static spec doc, 3 lanes: Caption / Shared / React |
| `Captionist Components.dc.html` | Component library with specs and states |
| `assets/` | 32 animated GIFs (`gif2-*`), 5 static memes, 7 avatars, logo, QR |

---

## 1. Product model

Captionist is a live meme-caption game for engineering teams. A room of 3–20 players plays 5 rounds; a rotating role holder sets up each round, everyone else competes, the room ranks its top three, points accrue, a champion is crowned.

**Two modes, one round engine.** Only two beats differ:

| | `mode: 'caption'` — Caption the image | `mode: 'react'` — React to the caption |
|---|---|---|
| Role name | Captionist | Prompter |
| Role supplies | a GIF (Giphy search or upload) | a text prompt, no image |
| Everyone supplies | top/bottom caption text | a GIF answer (Giphy search or upload) |
| Vote surface | captions over one shared image | images against one shared prompt |
| Card overlays | caption text on the image | none — the image *is* the answer |

Shared by both: entry, lobby/share, round opener, submission tracking, ranking, tie-breaker, reveal, scoreboard, podium, chat, reactions, host toolbox, edge states. **Never fork a shared screen to add mode behaviour** — branch the values in the logic class and toggle `display` in the template.

Round flow: `landing → join|setup → lobby → [round opener] → pick|prompt → caption|submit → waiting → vote → (tiebreak) → reveal → score → … → podium`

---

## 2. Tokens

### Surfaces
| Value | Use |
|---|---|
| `#0A0A0B` | app canvas |
| `#0D0E0F` | lobby, scoreboard |
| `#0E0F10` | header fill, chat rail |
| `#131415` | vote canvas, setup canvas |
| `#17181A` | modal / interstitial card |
| `#1B1C1C` | cards, popovers, toolbox |
| `#1D1E1F` | timer pill (neutral) |
| `#232426` | snackbar |
| `#242425` | segmented-control track |
| `#303031` | fields, active segment |

### Accents
| Value | Use |
|---|---|
| `#7B61FF` | primary action, focus ring, selection |
| `#8B74FF` | primary hover |
| `#A18FFF` | accent text, eyebrows, links |
| `#C9BCFF` | icons/text on accent fills |
| `#F6E338` | winner, 1st place |
| `#83D06C` | success, online, submitted |
| `#FF787D` | urgency (≤15s), destructive, unread badge |

Tints: `rgba(123,97,255,.10–.30)` accent fills, `rgba(123,97,255,.26–.55)` accent borders, `rgba(255,120,125,.14)` destructive fill, `rgba(246,227,56,.09–.14)` winner fill.

### Text on dark
`#fff` primary · `rgba(255,255,255,.78)` chat body · `.55` body copy · `.45` labels · `.4` meta · `.35` captions/disabled · `.28–.3` timestamps.

### Type — Inter (400/500/600/700/800)
| Role | Spec |
|---|---|
| Display | `clamp(38px,5–7.2vw,98px)` / 800 / `-.035…-.04em` / line-height .94–1.06 |
| Screen title | 30–42px / 800 / `-.025…-.03em` |
| Card title | 20–22px / 700 |
| Section heading | 20px / 600 |
| Body | 16–21px / 500 / line-height 1.45–1.6 |
| Chat body | 14px / 400 / 1.45 |
| Label | 13–15px / 600–700 |
| Eyebrow | 10–14px / 800 / `.06–.14em` / uppercase |
| Numeric | 24–32px / 800 (scores), 44–58px / 800 (room code) |

Never below 12px. Add `text-wrap:pretty` to paragraphs, `text-wrap:balance` to display headlines.

### Radii
`143px` pills/buttons · `24px` modals + big surfaces · `16px` cards · `12–14px` fields, popovers, list rows · `10px` toolbox buttons, chat attachments · `8–9px` media, small fields, picker tiles · `50%` avatars · `99px` pips/bars.

### Spacing
Screen padding `40–60px` (h) / `24–56px` (v). Header `72px` tall, `0 40px`. Gaps `2 / 5 / 6 / 8 / 10 / 12 / 14 / 20 / 26 / 34 / 44 / 52`. Card padding `20–26px`. Rail padding `16px`.

### Elevation & effects
```
popover   0 20px 50px rgba(0,0,0,.65)
toolbox   0 24px 60px rgba(0,0,0,.6)
snackbar  0 18px 44px rgba(0,0,0,.6)
modal     0 0 90px rgba(123,97,255,.28), 0 30px 80px rgba(0,0,0,.7)
winner    0 0 0 4px #F6E338, 0 24px 60px rgba(0,0,0,.6)
hairline  1px solid rgba(255,255,255,.06–.09)
focus     inset 0 0 0 2px #7B61FF
backdrop  rgba(6,6,7,.80–.82) + backdrop-filter: blur(10px)
```
Disconnect/error modals swap the purple glow for `rgba(255,120,125,…)`.

### Keyframes (declare in `<helmet>`, never inline-driven)
```css
@keyframes pop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes rise{0%{opacity:0;transform:translate(0,0) scale(.6)}14%{opacity:1;transform:translate(0,-34px) scale(1.06)}100%{opacity:0;transform:translate(var(--dx,0px),-430px) scale(.9)}}
@keyframes toastin{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:none}}
@keyframes gcy{0%,22%{opacity:1}26%,96%{opacity:0}100%{opacity:1}}
```

---

## 3. Components

Full visual reference with states: `Captionist Components.dc.html`.

**Button** — primary pill `#7B61FF` → hover `#8B74FF`; 51px tall for form CTAs, `15px 40px` inline. Secondary `rgba(255,255,255,.07)` → `.14`. Outline `1px solid rgba(255,255,255,.22)`. Destructive `rgba(255,120,125,.14)` + `#FF787D`. Toolbox variant: 10px radius, `11px 16px`, `white-space:nowrap`.
Blocked ≠ disabled: keep the tint at 30% and put the reason in the label (`Pick 2 more`).

**Segmented control** — track `#242425` (or `#1B1C1C` on cards), 3px inset, 11px radius; active pill `#303031` + white 600; inactive 45% white. Uploader variant carries a search-glass and upload-tray icon.

**Text field** — 62px caption inputs, 52px search, 46px chat composer, 34px popover search. Fill `rgba(255,255,255,.08)` or `#1B1C1C`; the on-focus/primary field gets `inset 0 0 0 2px #7B61FF`. Counter above right, `13px/500/.3`.

**Toggle** 44×24, 16px track, 24px white knob, `transition:left .16s`. **Stepper** 36×44 keys + 88×44 value, `#303031`.

**Dropzone** — 300px, 16px radius, `2px dashed rgba(255,255,255,.16)`; drag-over `rgba(123,97,255,.08)` + `#7B61FF` border; resolves to a file-ready card (preview 300×260, name, size, confirm + Replace). Identical in both modes.

**Timer pill** — `7px 15px` pill; neutral `#1D1E1F`/white, urgent (≤15s or sudden death) `rgba(255,120,125,.14)`/`#FF787D`. Optional 3px progress rail beneath the header.

**Avatar** — colour-filled circle, art at ~78%; sizes 26/30/34/40/46/56/88/108. Selected `0 0 0 2px #7B61FF`; unselected `opacity:.55`; overflow chip `+N` on `rgba(255,255,255,.08)`.

**Media card** — 8px radius, `object-fit:cover`, image 170–210px. Caption overlays: 14–32px/800/uppercase with `text-shadow:0 ±1.5–2px 0 #000` on all four sides. Rank ring `#F6E338` (1st) / `rgba(255,255,255,.55)` (2nd–3rd), rank badge 28px circle top-right, tally pills bottom-left, own-entry overlay `rgba(10,10,11,.5)` + `opacity:.4`.

**Prompt banner** — `rgba(123,97,255,.1)` + `rgba(123,97,255,.26)` border; `PROMPT` label 11px/800/`#A18FFF` and the quote at 18–26px/700 in curly quotes. Always its own full-width line.

**Chat message** — 30px avatar, 10px gap; name 13/700 + time 11/500/.28; body 14/400/1.45/.78. Attachment 180×120 @10px. Host announcement replaces the row with an accent card (`rgba(123,97,255,.12)`, send glyph, `NAME · HOST` eyebrow). Unread divider: accent rule + `N NEW` pill.

**Reaction CTA** — smiley + plus glyph pair (never a bare `+`), 28–34px pill or 44px rail square. Opens the searchable toolbar.

**Reaction toolbar** — 250–274px popover, title eyebrow, search field, 5-column tile grid (36–42px), 132–196px scroll cap, empty state. Defaults = 6 emoji + 4 Slackmoji GIFs; search widens to the full set matched on keywords. Flips to `bottom:` anchoring in the lower third of a list.

**Tally pill** — over media `rgba(10,10,11,.8)` + `backdrop-filter:blur(6px)`; in chat `rgba(255,255,255,.06)`; yours gains `1px solid rgba(123,97,255,.45–.55)` and `#C9BCFF` count.

**Snackbar** — `#232426` pill, `1px solid rgba(255,255,255,.14)`, 24px green check, `13px 20px 13px 16px`; bottom-centred over the content column (offset by rail width), `toastin .2s`, auto-dismiss 2.8s, one at a time.

**Modal** — 24px radius `#17181A`, accent border, glow shadow, blurred backdrop; split layout with a 300px media rail. Progress dots 8px → 26px active. Back/Next grouped as a pair on the right.

**Round-opener interstitial** — 560px centred card, round eyebrow, mode pill, headline, role chip, skip link; auto-dismiss 3.8s.

**Chat rail** — 360px docked / 64px strip, sticky `height:100vh`, `align-self:flex-start`, left hairline, `z-index:40`. Collapsed: unread badge `#FF787D` with `2px solid #0E0F10` ring, reaction CTA, avatar stack, vertical `CHAT` label; message toasts bottom-right at `z-index:65`.

**Host toolbox** — 340px, 20px radius, fixed bottom-right offset by rail width; collapses to a pill FAB.

---

## 4. Interaction rules

1. **One primary action per screen** — the one that advances the phase.
2. **Every invisible action confirms** with a snackbar (copy link, share, mode switch, upload accepted).
3. **One overlay surface at a time** — opening the room picker, a message picker, a card picker or the GIF panel closes the other three.
4. **Reaction affordances are uniform** — smiley-plus icon, searchable toolbar, everywhere.
5. **Anonymity until reveal** — no author names on vote cards in either mode; reveal is where identity lands.
6. **Timers are honest** — phases auto-advance at zero; ≤15s turns the pill red; the host can pause, ±10s or skip.
7. **Blocked, not disabled** — state what's missing in the label.
8. **Chat is never modal** — it docks beside content, never over it; overlays sit above both.
9. **Mode is always legible** — header settings line, round opener, and the help modal's switcher.
10. **Uploads are first-class** — anywhere Giphy is offered, upload is offered with the same component.

---

## 5. Implementation conventions (Design Components)

The prototype is one DC: `Captionist Prototype.dc.html` — template + `class Component extends DCLogic`.

- **Inline styles only.** No stylesheets or classes. `<helmet>` holds only `@font-face`, `@keyframes`, body resets, font links.
- **No JS in template holes.** `{{ dotted.path }}` only; compute in `renderVals()`.
- **Screens are `<sc-if>` blocks** keyed off `is<Screen>` flags; lists use `<sc-for>` with `hint-placeholder-count`.
- **Mode branching:** value-level, e.g. `waitSrc: s.mode === 'react' ? … : …`, and `display:{{ x.textShow }}` in markup. Never duplicate a screen per mode.
- **Show/hide via `display` values from the logic** (`'flex'`/`'none'`), not conditional markup, inside `<sc-for>`.
- **Animated elements** (reaction floaters) are built with `React.createElement` in `renderVals()` and keyed by id so animation survives re-render — everything else is template markup so it stays editable.
- **Empty image sources** use the transparent `BLANK` data URI, never `''` (an empty `src` refetches the page).
- **Timers:** one 1s interval, gated on `screen` membership and paused by `intro`/`help`.
- **Fixed overlays** are offset by rail width (`railW = chatOpen ? 360 : 64`) so nothing sits under the rail.
- **Z-index ladder:** rail 40 · toolbox/FAB 50 · toasts 65 · reaction picker 70 · floaters 75 · interstitial 80 · help modal 90 · snackbar 95.

### Copy voice
Dry, engineering-team humour; second person; short sentences. Deploys, prod, on-call, retros, standups are the shared vocabulary. Never cute mascot-speak, never exclamation stacking. Real examples: "Make it hurt. Make it funny.", "Brace yourself. Last time they picked a 4-second clip of a burning server rack.", "Say something regrettable…", "Somebody has to break this tie."

### Adding a feature — checklist
1. Does it belong to one mode or both? Both ⇒ shared screen with branched values.
2. Which existing component covers it? Reuse before inventing.
3. Does it need a confirmation? Snackbar.
4. Does it open a surface? Close the other three.
5. Does it change the round flow? Update `advance()`, the ticker list, the urgency list, and the round-opener copy.
6. Update all three files: prototype, screens doc lane, component library.
