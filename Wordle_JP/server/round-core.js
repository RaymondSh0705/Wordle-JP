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

export function createJishoLookup(fetchImpl = fetch) {
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
    // Keep an isolate's in-memory cache bounded.
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(word, result.data);
    return result.data;
  };
}

export function createCommonChecker(fetchImpl = fetch) {
  const lookup = createJishoLookup(fetchImpl);
  return async (word, signal) => isExactCommonMatch(await lookup(word, signal), word);
}

export function getKanjiSpelling(data, word, commonOnly = false) {
  for (const entry of data) {
    if (commonOnly && entry.is_common !== true) continue;
    const form = entry.japanese?.find((item) => typeof item.reading === 'string'
      && normalizeGuess(item.reading) === word
      && typeof item.word === 'string' && /\p{Script=Han}/u.test(item.word));
    if (form) return form.word;
  }
  return null;
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

export function createRoundApi({ getDictionary, fetchImpl = fetch }) {
  const lookup = createJishoLookup(fetchImpl);
  const isCommon = async (word, signal) => isExactCommonMatch(await lookup(word, signal), word);
  return async (req) => {
    const url = new URL(req.url);
    const send = (status, data) => Response.json(data, {
      status, headers: { 'Cache-Control': 'no-store' },
    });
    if (url.pathname !== '/api/round') return send(404, { error: 'API route not found.' });
    if (req.method !== 'GET') return send(405, { error: 'Use GET to start a round.' });
    const length = Number(url.searchParams.get('length'));
    if (!Number.isInteger(length) || length < 4 || length > 8) {
      return send(400, { error: 'Choose a word length between 4 and 8.' });
    }
    try {
      const dictionary = await getDictionary();
      const signal = AbortSignal.timeout(30000);
      const commonOnly = url.searchParams.get('common') === 'true';
      const target = await chooseTarget(dictionary[length], { commonOnly, isCommon, signal });
      let kanji = null;
      let kanjiNotice = '';
      if (url.searchParams.get('kanji') === 'true') {
        try {
          kanji = getKanjiSpelling(await lookup(target, signal), target, commonOnly);
        } catch {
          kanjiNotice = 'Kanji lookup is unavailable for this round.';
        }
      }
      return send(200, { target, kanji, kanjiNotice });
    } catch (error) {
      const message = ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'Jisho took too long to respond. Try again or turn off Common words only.'
        : error.code === 'ENOENT'
          ? 'Dictionary data is missing. Run npm run dictionary first.'
          : error instanceof TypeError
            ? 'Could not reach Jisho. Try again or turn off Common words only.'
            : error.message;
      return send(503, { error: message });
    }
  };
}
