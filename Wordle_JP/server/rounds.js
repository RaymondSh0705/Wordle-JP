import { readFile } from 'node:fs/promises';
import { normalizeGuess, splitKana } from '../src/kana.js';

export function prepareDictionary(raw) {
  const buckets = {};
  // Recount with the same character-count rules as the board, including normalized kana.
  for (const word of new Set(Object.values(raw).flat().map(normalizeGuess))) {
    const length = splitKana(word).length;
    if (length < 4 || length > 8 || !/^[ぁ-ゖー]+$/u.test(word)) continue;
    (buckets[length] ??= []).push(word);
  }
  return buckets;
}

export function isExactCommonMatch(data, word) {
  return data.some((entry) => entry.is_common === true
    && entry.japanese?.some((form) =>
      [form.reading, form.word].some((value) =>
        typeof value === 'string' && normalizeGuess(value) === word)));
}

export function createCommonChecker(fetchImpl = fetch) {
  const cache = new Map();
  return async (word, signal) => {
    if (cache.has(word)) return cache.get(word);
    const url = new URL('https://jisho.org/api/v1/search/words');
    url.searchParams.set('keyword', word);
    const response = await fetchImpl(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Kotobadle/1.0 (Japanese word game)',
      },
    });
    if (!response.ok) throw new Error('Jisho is unavailable. Please try again later or turn off Common words only.');
    const result = await response.json();
    if (result.meta?.status !== 200 || !Array.isArray(result.data)) {
      throw new Error('Jisho returned an unexpected response. Please try again later.');
    }
    const common = isExactCommonMatch(result.data, word);
    cache.set(word, common);
    return common;
  };
}

export async function chooseTarget(words, {
  commonOnly = false,
  isCommon,
  random = Math.random,
  signal = AbortSignal.timeout(30000),
  pause = () => new Promise((resolve) => setTimeout(resolve, 250)),
} = {}) {
  if (!words?.length) throw new Error('No words are available for this word length.');
  if (!commonOnly) return words[Math.floor(random() * words.length)];

  const candidates = [...words];
  // Sample without replacement, with bounded traffic and a bounded wait.
  for (let attempt = 0; attempt < 30 && candidates.length; attempt += 1) {
    signal.throwIfAborted();
    const index = Math.floor(random() * candidates.length);
    const [candidate] = candidates.splice(index, 1);
    if (await isCommon(candidate, signal)) return candidate;
    await pause();
  }
  throw new Error('No common word was found in this sample. Try again, choose a shorter length, or turn off Common words only.');
}

export function createRoundHandler() {
  let dictionary;
  const isCommon = createCommonChecker();
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/round') return next();
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'GET') return send(405, { error: 'Use GET to start a round.' });
    const length = Number(url.searchParams.get('length'));
    if (!Number.isInteger(length) || length < 4 || length > 8) {
      return send(400, { error: 'Choose a word length between 4 and 8.' });
    }
    try {
      dictionary ??= prepareDictionary(JSON.parse(await readFile(new URL('./data/dictionary.json', import.meta.url), 'utf8')));
      const target = await chooseTarget(dictionary[length], {
        commonOnly: url.searchParams.get('common') === 'true',
        isCommon,
      });
      send(200, { target });
    } catch (error) {
      const message = ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'Jisho took too long to respond. Try again or turn off Common words only.'
        : error.code === 'ENOENT'
          ? 'Dictionary data is missing. Run npm run dictionary first.'
          : error instanceof TypeError
            ? 'Could not reach Jisho. Try again or turn off Common words only.'
            : error.message;
      send(503, { error: message });
    }
  };
}
