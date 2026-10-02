import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chooseTarget, createCommonChecker, createRoundHandler, getKanjiSpelling, isExactCommonMatch, prepareDictionary } from './rounds.js';
import { splitKana } from '../src/kana.js';

test('dictionary grouping uses the same normalized character counts as the UI', () => {
  assert.deepEqual(prepareDictionary({ 5: ['キョウシツ', 'きょうしつ', '教室', 'ねこ', 'あいうえお'] }), {
    5: ['きょうしつ', 'あいうえお'],
  });
});

test('unfiltered targets are random dictionary choices without Jisho calls', async () => {
  const words = ['あいうえ', 'きょうしつ'];
  const isCommon = () => { throw new Error('Jisho should not be called'); };
  assert.equal(await chooseTarget(words, { random: () => 0, isCommon }), words[0]);
  assert.equal(await chooseTarget(words, { random: () => 0.99, isCommon }), words[1]);
  await assert.rejects(chooseTarget([]), /No words/);
});

test('a common result must match the exact normalized reading', () => {
  assert.equal(isExactCommonMatch([{ is_common: true, japanese: [{ reading: 'キョウシツ' }] }], 'きょうしつ'), true);
  assert.equal(isExactCommonMatch([{ is_common: true, japanese: [{ reading: 'きょう' }] }], 'きょうしつ'), false);
  assert.equal(isExactCommonMatch([{ is_common: false, japanese: [{ reading: 'きょうしつ' }] }], 'きょうしつ'), false);
});

test('common selection skips uncommon words and never silently falls back', async () => {
  const checked = [];
  const options = {
    commonOnly: true, random: () => 0, pause: async () => {},
    isCommon: async (word) => { checked.push(word); return word === 'きょうしつ'; },
  };
  assert.equal(await chooseTarget(['あいうえ', 'きょうしつ'], options), 'きょうしつ');
  assert.deepEqual(checked, ['あいうえ', 'きょうしつ']);
  await assert.rejects(chooseTarget(['あいうえ'], options), /No common word/);
  await assert.rejects(chooseTarget(['あいうえ'], {
    ...options, isCommon: async () => { throw new Error('offline'); },
  }), /offline/);
});

test('common lookup uses the Jisho keyword GET endpoint and caches results', async () => {
  let requests = 0;
  const check = createCommonChecker(async (url, options) => {
    requests += 1;
    assert.equal(url.origin + url.pathname, 'https://jisho.org/api/v1/search/words');
    assert.equal(url.searchParams.get('keyword'), 'きょうしつ');
    assert.equal(options.headers['User-Agent'], 'Kotobadle/1.0 (Japanese word game)');
    return { ok: true, json: async () => ({ meta: { status: 200 }, data: [
      { is_common: true, japanese: [{ reading: 'きょうしつ' }] },
    ] }) };
  });
  const signal = AbortSignal.timeout(1000);
  assert.equal(await check('きょうしつ', signal), true);
  assert.equal(await check('きょうしつ', signal), true);
  assert.equal(requests, 1);
});

test('failed Jisho responses are rejected and not cached', async () => {
  let requests = 0;
  const check = createCommonChecker(async () => {
    requests += 1;
    return { ok: false };
  });
  const signal = AbortSignal.timeout(1000);
  await assert.rejects(check('きょうしつ', signal), /unavailable/);
  await assert.rejects(check('きょうしつ', signal), /unavailable/);
  assert.equal(requests, 2);
});

test('round API loads the real exported dictionary at every supported length', async () => {
  const dictionary = prepareDictionary(JSON.parse(await readFile(new URL('./data/dictionary.json', import.meta.url), 'utf8')));
  const handler = createRoundHandler();
  for (let length = 4; length <= 8; length += 1) {
    let status;
    let result;
    const response = {
      writeHead(code) { status = code; },
      end(body) { result = JSON.parse(body); },
    };
    await handler({ url: `/api/round?length=${length}&common=false`, method: 'GET' }, response, () => assert.fail('Unhandled request'));
    assert.equal(status, 200);
    assert.equal(splitKana(result.target).length, length);
    assert.ok(dictionary[length].includes(result.target));
  }
});


test('Kanji hint requires an exact reading and a spelling containing kanji', () => {
  const entries = [
    { japanese: [{ word: '今日', reading: 'きょう' }] },
    { japanese: [{ word: 'キョウシツ', reading: 'きょうしつ' }] },
    { is_common: true, japanese: [{ word: '教室', reading: 'きょうしつ' }] },
  ];
  assert.equal(getKanjiSpelling(entries, 'きょうしつ'), '教室');
  assert.equal(getKanjiSpelling(entries, 'きょうしつ', true), '教室');
  assert.equal(getKanjiSpelling(entries, 'きょう', true), null);
  assert.equal(getKanjiSpelling([], 'きょうしつ'), null);
  assert.equal(getKanjiSpelling([{ japanese: [{ reading: 'きょうしつ' }] }], 'きょうしつ'), null);
});
