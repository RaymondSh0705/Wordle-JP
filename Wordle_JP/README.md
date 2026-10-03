# Kotobadle

A Japanese kana guessing game built with React and Vite.

## Run locally

```sh
npm install
npm run dev
```

Start a round from the home screen. Settings controls the number of kana characters
(4–8) and whether the target must be a common word. Hard mode and Show hints
remain placeholders. Settings are kept in memory until the page is refreshed.

Each round picks a random target from the dictionary. The same target stays in
place for all six guesses. A correct guess opens the win dialog; six unsuccessful
guesses open the loss dialog. Both reveal the answer and offer Play again or Home.

## Dictionary

`server/data/dictionary.json` is generated from `../dict.pkl`, whose keys are
lengths and values are lists of readings. After replacing or updating the pickle:

```sh
npm run dictionary
```

Restart the dev or production server after exporting, because it caches the word
list in memory. The exporter uses Python 3 and accepts only plain dictionary data.
The export command then runs `scripts/prepare_dictionary.js` to normalize readings,
deduplicate them, remove non-kana entries, and group them using the same rules as
the board. Both server runtimes consume this prepared JSON directly. Every normalized character occupies one tile, including small kana: `きゃ` uses
two tiles and `きょうしつ` uses five. This matches the updated Python dictionary.

## Common-word lookup

The browser requests `GET /api/round?length=5&common=true` from the game server.
The server samples dictionary candidates and sends
`GET https://jisho.org/api/v1/search/words?keyword=<candidate>`.
A candidate qualifies only when a result has `is_common: true` and a Japanese
reading or spelling that exactly matches the normalized candidate.

Jisho requests run on the server, so the browser does not need cross-origin
access to Jisho. Successful lookup results are cached in server memory. Common
mode checks at most 30 candidates, spaces uncached attempts, and has a 30-second
selection deadline with an 8-second timeout per Jisho request. If the sample has
no common word or Jisho is unavailable, the game shows an error and allows a
retry; it never silently substitutes an unchecked word. Longer word lengths may
need a retry. Common mode requires an internet connection; ordinary rounds do not.

## Build and run

```sh
npm run build
npm start
```

The Node server serves the built app and the round API at `http://localhost:3000`.
Set `PORT` to use another port. Deploy `dist/`, `server/`, `src/kana.js`, and
`package.json` together with a compatible Node runtime. Hosting only `dist/` will
not provide the round API. `npm run preview` also includes the API for local build
checks.

## Validation

```sh
npm test
npm run lint
npm run build
```

Tests cover kana counting, normalization, dictionary targets for every supported
length, Jisho response matching and caching, failure handling, win/loss rules, and duplicate-aware kana feedback.
Browser IME behavior and animation appearance should also be checked manually.

Targets are returned to the browser, so this is a casual client-side game, not an
anti-cheat implementation. Dictionary validation of guesses is not implemented yet.

## Board and Japanese keyboard

The guess board sits on the left and the kana reference grid on the right; they
stack on narrow screens. The keyboard updates only after a submitted guess:
dark gray means absent, yellow means misplaced, and green means a correct
position. It retains the strongest result for each kana across all guesses.
Repeated kana are scored against the number of occurrences in the target.

During Japanese IME composition, the active row previews the current input,
including live conversion, without changing the native composition buffer.
The Enter that confirms an IME conversion does not submit a guess. Overlong
previews leave the row unchanged; an overlong committed edit restores the last
accepted guess. Kanji previews can appear, but submitted guesses must use kana.

## Mods and tile feedback

Settings includes two optional mods, applied when you start a round:

- **Kanji** shows a kanji spelling whose Jisho reading exactly matches the target.
  Common-only rounds require that spelling to come from a common entry too.
  Kana-only words show a no-spelling notice; lookup failures show an unavailable
  notice and still allow the round to start. Multiple words can share a reading,
  so the hint uses the first matching spelling. Jisho results are shared with the
  common-word check to avoid an extra request for the selected target.
- **Bubble** reveals whether the keys immediately above, below, left, and right
  of each submitted kana occur in the target. It skips empty cells and never
  spreads recursively. These extra hints are yellow or gray; green still requires
  a correct-position guess.

Submitted tiles turn green for exact matches and yellow for misplaced kana.
Other submitted tiles retain their original background. Submitted outlines are
removed. Tiles remain 75px square (the previous six-kana tile size), with the
board centered in the left 70% on desktop. Narrow screens stack the sections and
scroll the board horizontally instead of shrinking its tiles.

## Cloudflare Worker adapter

Steps 1 and 2 of the Cloudflare migration are implemented:

- `worker/index.js` exports a Worker with `fetch(request, env)`. Its static JSON
  import packages the prepared dictionary with the Worker; it never reads local
  files at runtime.
- `worker/handler.js` routes `/api/round` to the shared API and delegates frontend
  requests to `env.ASSETS.fetch(request)`. Unknown API routes return JSON 404s.
- `server/round-core.js` contains the runtime-independent round and Jisho logic.
  `server/rounds.js` adapts this to the existing Node/Vite middleware, so local
  development and `npm start` continue to work.
- `npm run dictionary` exports `../dict.pkl` and prepares
  `server/data/dictionary.json` before deployment. Keep this generated JSON with
  the project. Neither Python nor the pickle file is needed on Cloudflare.

Worker tests run under Node's Web APIs with mocked asset/Jisho bindings as part
of `npm test`. They cover the actual Worker entry point and generated dictionary;
they are not a Cloudflare runtime/deployment test.

Wrangler installation, account login, and deployment configuration are still
separate steps. The future configuration should use `worker/index.js` as `main`,
`dist` as the assets directory, an `ASSETS` binding, and Worker-first routing for
`/api/*`. No Cloudflare resources have been created or deployed.
