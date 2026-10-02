import { useEffect, useRef, useState } from 'react'
import { normalizeGuess, splitKana } from './kana.js'
import { getKeyboardStatuses, getRoundOutcome, scoreGuess, MAX_GUESSES } from './game.js'
import KanaKeyboard from './KanaKeyboard.jsx'
import './App.css'

function App() {
  const [page, setPage] = useState('home');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [compositionPreview, setCompositionPreview] = useState(null);
  const committedGuess = useRef('');
  const [inputError, setInputError] = useState('');
  const [targetWord, setTargetWord] = useState(null);
  const [kanjiHint, setKanjiHint] = useState(null);
  const [kanjiNotice, setKanjiNotice] = useState('');
  const [roundLoading, setRoundLoading] = useState(false);
  const [roundError, setRoundError] = useState('');
  const roundRequest = useRef(null);
  const resultDialog = useRef(null);
  const outcome = getRoundOutcome(guesses, targetWord);
  const isComposing = useRef(false);
  const guessInput = useRef(null);
  const settingsDialog = useRef(null);
  const [gameSettings, setGameSettings] = useState({
    wordLength: 5,
    hardMode: false,
    showHints: true,
    commonOnly: false,
    kanjiMod: false,
    bubbleMod: false,
  });
  const [draftSettings, setDraftSettings] = useState(gameSettings);

  useEffect(() => {
    if (page !== 'game' || outcome || roundLoading) return;

    const focusActiveRow = () => guessInput.current?.focus({ preventScroll: true });
    const keepRowFocused = (event) => {
      if (event.target === guessInput.current) return;
      event.preventDefault();
      focusActiveRow();
    };

    focusActiveRow();
    document.addEventListener('pointerdown', keepRowFocused);
    window.addEventListener('focus', focusActiveRow);
    return () => {
      document.removeEventListener('pointerdown', keepRowFocused);
      window.removeEventListener('focus', focusActiveRow);
    };
  }, [page, guesses.length, outcome, roundLoading]);

  useEffect(() => {
    if (outcome && page === 'game' && !resultDialog.current.open) {
      resultDialog.current.showModal();
    }
  }, [outcome, page]);

  useEffect(() => () => roundRequest.current?.abort(), []);

  function previewComposition(input) {
    const preview = normalizeGuess(input.value);
    // Render live conversion without rewriting the browser's IME buffer.
    if (splitKana(preview).length <= gameSettings.wordLength) {
      setCompositionPreview(preview);
      setInputError('');
    }
  }

  function updateGuess(input) {
    const nextGuess = normalizeGuess(input.value);
    if (splitKana(nextGuess).length <= gameSettings.wordLength) {
      committedGuess.current = nextGuess;
      setCurrentGuess(nextGuess);
      setInputError('');
      input.value = nextGuess;
    } else {
      input.value = committedGuess.current;
    }
  }

  // handles rejected guess
  function rejectGuess(message) {
    setInputError(message);
    const row = guessInput.current?.parentElement;
    if (row && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      row.getAnimations().forEach((animation) => animation.cancel());
      row.animate(
        { transform: ['translateX(0)', 'translateX(-4px)', 'translateX(4px)', 'translateX(-3px)', 'translateX(3px)', 'translateX(0)'] },
        { duration: 240, easing: 'ease-in-out' },
      );
    }
    guessInput.current?.focus();
  }

  async function startGame() {
    if (roundRequest.current) return;
    const controller = new AbortController();
    roundRequest.current = controller;
    setRoundLoading(true);
    setRoundError('');
    try {
      const query = new URLSearchParams({
        length: String(gameSettings.wordLength),
        common: String(gameSettings.commonOnly),
        kanji: String(gameSettings.kanjiMod),
      });
      const response = await fetch(`/api/round?${query}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start a round. Please try again.');
      if (typeof data.target !== 'string' || splitKana(data.target).length !== gameSettings.wordLength) {
        throw new Error('The server returned an invalid target word. Please try again.');
      }
      resultDialog.current?.close();
      setTargetWord(normalizeGuess(data.target));
      setKanjiHint(data.kanji ?? null);
      setKanjiNotice(data.kanjiNotice ?? '');
      setGuesses([]);
      setCurrentGuess('');
      committedGuess.current = '';
      setCompositionPreview(null);
      setInputError('');
      isComposing.current = false;
      setPage('game');
    } catch (error) {
      if (!controller.signal.aborted) {
        setRoundError(error.name === 'TimeoutError'
          ? 'Choosing a word took too long. Please try again.'
          : error instanceof TypeError || error instanceof SyntaxError
            ? 'Could not reach the game server. Please try again.'
            : error.message);
      }
    } finally {
      if (roundRequest.current === controller) {
        roundRequest.current = null;
        setRoundLoading(false);
      }
    }
  }

  function submitGuess() {
    if (isComposing.current || outcome || roundLoading || !targetWord) return;

    const guess = normalizeGuess(currentGuess.trim());
    if (splitKana(guess).length !== gameSettings.wordLength) {
      rejectGuess(`Enter exactly ${gameSettings.wordLength} kana.`);
      return;
    }
    if (!/^[ぁ-ゖー]+$/u.test(guess)) {
      rejectGuess('Please enter kana using a Japanese keyboard.');
      return;
    }

    setGuesses([...guesses, guess]);
    setCurrentGuess('');
    committedGuess.current = '';
    setCompositionPreview(null);
    setInputError('');
  }

  function goHome() {
    roundRequest.current?.abort();
    roundRequest.current = null;
    setRoundLoading(false);
    setRoundError('');
    setTargetWord(null);
    resultDialog.current?.close();
    setPage("home");
  }

  function settings() {
    setDraftSettings({ ...gameSettings });
    settingsDialog.current.showModal();
  }

  function saveSettings(event) {
    event.preventDefault();
    setGameSettings({ ...draftSettings });
    settingsDialog.current.close();
  }

  if (page === "game") {
    return (
      <main className="game">
        <dialog
          ref={resultDialog}
          className={`settings-dialog result-dialog ${outcome || ''}`}
          aria-labelledby="result-title"
          aria-describedby="result-description"
          onCancel={(event) => { event.preventDefault(); goHome(); }}>
          <div className="result-content">
            <span className="result-symbol" aria-hidden="true">{outcome === 'won' ? '🎉' : '🌙'}</span>
            <h2 id="result-title">{outcome === 'won' ? 'You won!' : 'Round over'}</h2>
            <p id="result-description">
              {outcome === 'won'
                ? `You found the word in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}!`
                : 'You used all six guesses. Try a new word!'}
            </p>
            <p>The word was <strong lang="ja">{targetWord}</strong>.</p>
            <p role="status">{roundLoading ? 'Choosing your next word…' : roundError}</p>
            <div className="settings-actions">
              <button type="button" className="button" onClick={goHome}>Home</button>
              <button type="button" className="button" onClick={startGame} disabled={roundLoading}>
                {roundLoading ? 'Loading…' : 'Play again'}
              </button>
            </div>
          </div>
        </dialog>
        <h1>Kana Wordle</h1>
        <p id="guess-help">Enter {gameSettings.wordLength} kana per guess. Type to fill the active row.</p>
        <div className="game-layout">
          <section className="guess-panel" aria-label="Your guesses">
            {gameSettings.kanjiMod && (
              <p className="kanji-hint">Kanji: <strong lang="ja">{kanjiHint}</strong>{!kanjiHint && (kanjiNotice || 'No kanji spelling available for this word.')}</p>
            )}
            {gameSettings.bubbleMod && <p className="mod-note">Bubble: adjacent keys reveal whether their kana is in the word.</p>}
            <div className="board-scroll">
            <div className="word-board" role="group" aria-label="Guess board">
              {Array.from({ length: MAX_GUESSES }, (_, rowIndex) => {
                const letters = splitKana(guesses[rowIndex] ?? (
                  rowIndex === guesses.length ? (compositionPreview ?? currentGuess) : ''
                ));
                const scores = rowIndex < guesses.length ? scoreGuess(guesses[rowIndex], targetWord) : [];
                return (
                  <div
                    key={rowIndex}
                    className={`word-row${rowIndex === guesses.length && !outcome ? ' active' : ''}`}
                    role="group"
                    aria-label={`Guess ${rowIndex + 1}`}
                    style={{ gridTemplateColumns: `repeat(${gameSettings.wordLength}, var(--tile-size))` }}>
                    {Array.from({ length: gameSettings.wordLength }, (_, columnIndex) => (
                      <span key={columnIndex} className={`word-tile${rowIndex < guesses.length ? ` submitted ${scores[columnIndex]}` : ''}`} aria-hidden={rowIndex === guesses.length}>
                        {letters[columnIndex] || ''}
                      </span>
                    ))}
                    {rowIndex === guesses.length && !outcome && (
                      <input
                        ref={guessInput}
                        className="row-input"
                        type="text"
                        lang="ja"
                        aria-label={`Guess ${rowIndex + 1}, ${gameSettings.wordLength} kana`}
                        aria-describedby="guess-help guess-status"
                        aria-invalid={Boolean(inputError)}
                        defaultValue={currentGuess}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        onInput={(event) => {
                          if (isComposing.current || event.nativeEvent.isComposing) {
                            previewComposition(event.currentTarget);
                          } else {
                            updateGuess(event.currentTarget);
                          }
                        }}
                        onCompositionStart={() => {
                          isComposing.current = true;
                          setCompositionPreview(committedGuess.current);
                        }}
                        onCompositionUpdate={(event) => previewComposition(event.currentTarget)}
                        onCompositionEnd={(event) => {
                          isComposing.current = false;
                          updateGuess(event.currentTarget);
                          setCompositionPreview(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          if (isComposing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
                          event.preventDefault();
                          submitGuess();
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            </div>
            <button type="button" className="button" onClick={submitGuess} disabled={Boolean(outcome) || roundLoading}>
              Submit guess
            </button>
            <p id="guess-status" role="status">
              {inputError || (outcome
                ? outcome === 'won' ? 'You won!' : 'All six guesses used.'
                : `${guesses.length} of ${MAX_GUESSES} guesses entered.`)}
            </p>
            <button
              type="button"
              className="button"
              onClick={goHome}>
              Back to home
            </button>
          </section>
          <KanaKeyboard statuses={getKeyboardStatuses(guesses, targetWord, gameSettings.bubbleMod)} bubble={gameSettings.bubbleMod} />
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Settings Pop up */}
      <dialog
        ref={settingsDialog}
        className="settings-dialog"
        aria-labelledby="settings-description">
        <form onSubmit={saveSettings} className="settings-form">
          <h2 id="settings-description">Game Settings</h2>
          <label className="settings-field">
            Word length
            <select
              value={draftSettings.wordLength}
              onChange={(event) => setDraftSettings({
                ...draftSettings,
                wordLength: Number(event.target.value),
              })}>
              <option value={4}>4 kana</option>
              <option value={5}>5 kana</option>
              <option value={6}>6 kana</option>
              <option value={7}>7 kana</option>
              <option value={8}>8 kana</option>
            </select>
          </label>
          <label className="settings-field">
            Common words only
            <input
              type="checkbox"
              checked={draftSettings.commonOnly}
              onChange={(event) => setDraftSettings({
                ...draftSettings,
                commonOnly: event.target.checked,
              })}
            />
          </label>
          <label className="settings-field">
            Hard mode
            <input
              type="checkbox"
              checked={draftSettings.hardMode}
              onChange={(event) => setDraftSettings({
                ...draftSettings,
                hardMode: event.target.checked,
              })}
            />
          </label>
          <label className="settings-field">
            Show hints
            <input
              type="checkbox"
              checked={draftSettings.showHints}
              onChange={(event) => setDraftSettings({
                ...draftSettings,
                showHints: event.target.checked,
              })}
            />
          </label>
          <fieldset className="settings-mods">
            <legend>Mods</legend>
            <label className="settings-field">
              <span>Kanji<small>Show a kanji spelling of the target word.</small></span>
              <input type="checkbox" checked={draftSettings.kanjiMod}
                onChange={(event) => setDraftSettings({ ...draftSettings, kanjiMod: event.target.checked })} />
            </label>
            <label className="settings-field">
              <span>Bubble<small>Reveal presence for keys directly above, below, left, and right of guessed kana. Empty spaces stop the reveal.</small></span>
              <input type="checkbox" checked={draftSettings.bubbleMod}
                onChange={(event) => setDraftSettings({ ...draftSettings, bubbleMod: event.target.checked })} />
            </label>
          </fieldset>
          <div className="settings-actions">
            <button type="button" className="button" onClick={() => settingsDialog.current.close()}>
              Cancel
            </button>
            <button type="submit" className="button">Save</button>
          </div>
        </form>
      </dialog>
      {/* Main Menu */}
      <section id="center">
        <div>
          <h1
            font-size="100px"
            className="title">
            Kotobadle
          </h1>
          <p>
            Start クリックしてください
          </p>
          <p>
            Click Start to Begin!
          </p>
        </div>
        <div className="home-actions">
        <button
          type="button"
          className="button-main"
          disabled={roundLoading}
          onClick={startGame}>
          {roundLoading ? 'Choosing a word…' : 'Start!'}
        </button>
        <button
          type="button"
          className="button-main"
          disabled={roundLoading}
          onClick={settings}>
          Settings
        </button>
        </div>
        <p role="status">{roundLoading && gameSettings.commonOnly ? 'Checking Jisho for a common word…' : roundError}</p>
      </section>

      <div className="ticks"></div>
      {/* Instructions */}
      <section id="bottom">
        <div className="main" id="instruction">
          <h2>Instructions</h2>
          <h3>How to play!</h3>
          <p>~ Guess the Japanese word (kana) within 6 guesses. ~</p>
          <p>~ The color of the tile will change to show how close your guess was to the word. ~</p>
          <p>~ Half size kana (ょ) count as a chracter. ~</p>
          <p>~ Use hiragana and ー. ~</p>
        </div>
      </section>
    </>
  );
}

export default App
