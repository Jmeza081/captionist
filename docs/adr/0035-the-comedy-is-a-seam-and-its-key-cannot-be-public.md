# 0035 — The comedy is a seam, and its key cannot be public

**Status:** accepted · 2026-09-04

## Context

Bots wrote from six hardcoded strings picked by seat index. Making them worth
playing against means a model writes the lines — which raises a question the
GIF providers had already answered the other way.

[ADR 0020](./0020-giphy-is-called-from-the-browser.md) deleted `/api/gifs`
because Giphy's terms forbid proxying, and
[ADR 0022](./0022-the-gif-provider-is-a-seam.md) kept that shape for Klipy. Both
keys ship to the browser **by necessity**, and the accepted cost is that anyone
can read them.

`ANTHROPIC_API_KEY` is the opposite case. Nothing forbids a proxy, and a model
key handed to twenty browsers is a stranger's bill. So the reasoning that
removed the last server route is exactly the reasoning that requires this one.

## Decision

**The model is reached through our own route, behind the seat the server
already signs.**

- `lib/bots/` is the seam, shaped like `lib/gifs/`: types-only module, data-only
  personas, adapters, one `source.ts` resolving which road. `?brain=stub|live`
  and `NEXT_PUBLIC_BOTS_STUB` mirror `?gifs=` exactly, **including that the URL
  lever beats the environment in both directions** — `?gifs=live` was once a
  no-op for precisely that reason.
- `app/api/bots/turn/route.ts` reuses `verifySeat` verbatim. An unsigned
  request is a 403. An ungated route that proxies a model is a free-token
  faucet for anyone who finds the URL, and this is the boundary the app already
  trusts.
- **The route writes words only.** Every GIF is still fetched in the browser,
  because that is where the provider key lives and has to. The model's job is a
  *search query*; the browser's is turning it into a picture. Asking the server
  for a GIF would rebuild the proxy ADR 0020 deleted.
- **One call per phase, not per bot.** `BotBrain`'s `answers` and `ballots` are
  plural in the type. It is what keeps a five-round game at cents, and the only
  way to ask for lines that differ from each other — N independent calls cannot
  see what the others wrote and converge on the same joke.
- `claude-haiku-4-5`, with vision on the one job of five that needs eyes. **No
  `thinking` and no `effort`:** Haiku 4.5 predates adaptive thinking, so
  `output_config.effort` is rejected on it.
- The **stub is not a courtesy**. Playwright's Chromium resolves nothing but
  the dev server and a fresh clone has no key — the same two reasons
  `SAMPLE_GIFS` exists — so it is the road the whole suite takes, and the road
  a spent budget lands on.

## Consequences

**A key and a server surface come back**, with rows in the launch gate. That is
the cost, and it is the honest inverse of ADR 0020 rather than a contradiction
of it.

**Spend is capped in four places, and only one of them is code.** A prepaid
balance with auto-reload off is a physical ceiling; a monthly **spend limit** on
a dedicated Anthropic workspace is the tunable one (limits cannot be set on the
Default Workspace, so a separate workspace is required, and it carries a *rate*
limit too — a monthly cap cannot notice a loop that burns a budget in an hour);
`lib/bots/budget.ts` trips a few cents early so a host reads a sentence instead
of a round hitting a 400; and the route throttles per seat.

`budget.ts` caps a **room**, not every room — only the workspace limit does
that. The two are complementary, not redundant.

**An exhausted budget costs a joke, never a round.** Bots fall to the written-in
corpus and keep playing. The host gets a snackbar, never a modal: only the
host's explicit pause stops the room's clock, and no guest sees a dollar figure.

**Determinism goes, and the stub is what buys it back.** `?bots=` specs still
pass because they run on the corpus, which is positional exactly as the old
driver was.

**Roads not taken**, so they are not re-derived:

| | Why not |
| --- | --- |
| A free cloud tier (Gemini, Groq) | One shared bucket for every room ever hosted — it scales *inversely* with users and runs dry for everyone at once |
| An in-browser model (WebLLM) | The browser tier tops out near 1–3B, which writes flat captions; 400–900 MB resident in the one tab ADR 0003 says must not crash; and no phone host at all, in a mobile-first app |
| Ollama on the host's machine | Reachable even from HTTPS (`localhost` is a trustworthy origin), but needs an install, `OLLAMA_ORIGINS`, and a Chrome 142+ Local Network Access prompt |
| Baking jokes into committed JSON | Best quality per byte and free at runtime — but bots would recite rather than react, and a GIF outside the set has nothing written for it |
