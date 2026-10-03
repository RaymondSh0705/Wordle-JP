import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import dictionary from '../server/data/dictionary.json' with { type: 'json' };
import { createWorker } from './handler.js';
import { normalizeGuess, splitKana } from '../src/kana.js';

const request = (query = '', method = 'GET') => new Request(`https://kotobadle.example/api/round${query}`, { method });

test('exported dictionary is already normalized, deduplicated, and grouped', () => {
  const seen = new Set();
  for (const [length, words] of Object.entries(dictionary)) {
    assert.ok(Number(length) >= 4 && Number(length) <= 8);
    for (const word of words) {
      assert.equal(word, normalizeGuess(word));
      assert.equal(splitKana(word).length, Number(length));
      assert.match(word, /^[ぁ-ゖー]+$/u);
      assert.equal(seen.has(word), false);
      seen.add(word);
    }
  }
});

test('Worker entry selects bundled targets for every supported length', async () => {
  for (let length = 4; length <= 8; length += 1) {
    const response = await worker.fetch(request(`?length=${length}`), {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const result = await response.json();
    assert.ok(dictionary[length].includes(result.target));
  }
});

test('Worker handles bad requests and keeps unknown APIs out of the SPA', async () => {
  assert.equal((await worker.fetch(request('?length=9'), {})).status, 400);
  assert.equal((await worker.fetch(request('?length=5', 'POST'), {})).status, 405);
  assert.equal((await worker.fetch(new Request('https://kotobadle.example/api/missing'), {})).status, 404);
});

test('Worker delegates frontend requests to the static asset binding', async () => {
  const req = new Request('https://kotobadle.example/');
  const response = await worker.fetch(req, { ASSETS: { fetch: async (incoming) => {
    assert.equal(incoming, req);
    return new Response('<html>game</html>');
  } } });
  assert.equal(await response.text(), '<html>game</html>');
});

test('common selection and Kanji reuse one Jisho lookup through the Worker', async () => {
  let calls = 0;
  const app = createWorker({ 5: ['きょうしつ'] }, async (url) => {
    calls += 1;
    assert.equal(url.searchParams.get('keyword'), 'きょうしつ');
    return Response.json({ meta: { status: 200 }, data: [
      { is_common: true, japanese: [{ reading: 'きょうしつ', word: '教室' }] },
    ] });
  });
  const response = await app.fetch(request('?length=5&common=true&kanji=true'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { target: 'きょうしつ', kanji: '教室', kanjiNotice: '' });
  assert.equal(calls, 1);
});

test('Worker preserves common-mode errors and optional Kanji fallback', async () => {
  const app = createWorker({ 5: ['きょうしつ'] }, async () => { throw new TypeError('offline'); });
  assert.equal((await app.fetch(request('?length=5&common=true'), {})).status, 503);
  const response = await app.fetch(request('?length=5&kanji=true'), {});
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.kanji, null);
  assert.match(result.kanjiNotice, /unavailable/);
});
