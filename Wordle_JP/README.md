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
The Node server normalizes readings, deduplicates them, removes non-kana entries,
and groups them using the same rules as the board. Every normalized character occupies one tile, including small kana: `きゃ` uses
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
