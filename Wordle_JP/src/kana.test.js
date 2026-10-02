import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGuess, splitKana } from './kana.js';

test('small kana count separately, matching the Python dictionary', () => {
  assert.deepEqual(splitKana('きゃしゅちょ'), ['き', 'ゃ', 'し', 'ゅ', 'ち', 'ょ']);
  assert.deepEqual(splitKana('ティファ'), ['て', 'ぃ', 'ふ', 'ぁ']);
  assert.equal(splitKana('きょうしつ').length, 5);
});

test('small tsu, nasal n, and long vowel marks keep their own tiles', () => {
  assert.deepEqual(splitKana('まっちゃ'), ['ま', 'っ', 'ち', 'ゃ']);
  assert.deepEqual(splitKana('シャンプー'), ['し', 'ゃ', 'ん', 'ぷ', 'ー']);
  assert.deepEqual(splitKana('ゃゅ'), ['ゃ', 'ゅ']);
});

test('normalization makes equivalent voiced kana count identically', () => {
  assert.equal(normalizeGuess('ｷﾞｬ'), 'ぎゃ');
  assert.deepEqual(splitKana('き\u3099ゃ'), ['ぎ', 'ゃ']);
  assert.deepEqual(splitKana('ギャ'), ['ぎ', 'ゃ']);
  assert.deepEqual(splitKana(''), []);
});
