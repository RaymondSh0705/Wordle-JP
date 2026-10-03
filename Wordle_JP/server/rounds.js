import { readFile } from 'node:fs/promises';
import { createRoundApi } from './round-core.js';

// Preserve the existing imports for local tools and tests.
export { prepareDictionary, chooseTarget, createCommonChecker, createJishoLookup,
  getKanjiSpelling, isExactCommonMatch } from './round-core.js';

export function createRoundHandler() {
  let dictionary;
  const api = createRoundApi({
    getDictionary: async () => {
      dictionary ??= JSON.parse(await readFile(new URL('./data/dictionary.json', import.meta.url), 'utf8'));
      return dictionary;
    },
  });
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/round') return next();
    const response = await api(new Request(url, { method: req.method }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  };
}
