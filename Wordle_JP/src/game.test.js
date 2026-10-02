import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAdjacentKana, getKeyboardStatuses, getRoundOutcome, scoreGuess } from './game.js';

test('winning guesses end a round, including on the final attempt', () => {
  assert.equal(getRoundOutcome(['きょうしつ'], 'きょうしつ'), 'won');
  assert.equal(getRoundOutcome([...Array(5).fill('あいうえ'), 'きょうしつ'], 'きょうしつ'), 'won');
});

test('only six unsuccessful attempts produce a loss', () => {
  assert.equal(getRoundOutcome(Array(5).fill('あいうえ'), 'きょうしつ'), null);
  assert.equal(getRoundOutcome(Array(6).fill('あいうえ'), 'きょうしつ'), 'lost');
  assert.equal(getRoundOutcome([], 'きょうしつ'), null);
  assert.equal(getRoundOutcome([], null), null);
});


test('kana scoring distinguishes absent, misplaced, and correct positions', () => {
  assert.deepEqual(scoreGuess('さくかあ', 'さかなく'), ['correct', 'present', 'present', 'absent']);
});

test('exact matches consume repeated kana before misplaced matches', () => {
  assert.deepEqual(scoreGuess('ここここ', 'こころね'), ['correct', 'correct', 'absent', 'absent']);
  assert.deepEqual(scoreGuess('ここかか', 'かきくこ'), ['present', 'absent', 'present', 'absent']);
});

test('keyboard keeps strongest feedback within and across guesses', () => {
  assert.deepEqual(getKeyboardStatuses(['ここここ', 'あこああ'], 'こころね'), {
    こ: 'correct', あ: 'absent',
  });
  assert.equal(getKeyboardStatuses(['かこここ'], 'かきくこ').こ, 'correct');
  assert.deepEqual(getKeyboardStatuses([], 'こころね'), {});
});

test('small kana have separate positions and keyboard feedback', () => {
  assert.deepEqual(scoreGuess('きゃくしつ', 'きょうしつ'), ['correct', 'absent', 'absent', 'correct', 'correct']);
  const statuses = getKeyboardStatuses(['ゃきうしつ', 'きゃうしつ'], 'きょうしつ');
  assert.equal(statuses.き, 'correct');
  assert.equal(statuses.ゃ, 'absent');
  assert.equal(statuses.ょ, undefined);
});


test('Bubble uses orthogonal neighbors and does not cross gaps or edges', () => {
  assert.deepEqual(getAdjacentKana('あ'), ['か', 'い']);
  assert.deepEqual(getAdjacentKana('ゃ'), ['ぁ', 'っ']);
  assert.deepEqual(getAdjacentKana('ゔ'), []);
});

test('Bubble reveals only immediate neighbors, without inventing correct positions', () => {
  const statuses = getKeyboardStatuses(['ああああ'], 'かいうえ', true);
  assert.equal(statuses.あ, 'absent');
  assert.equal(statuses.か, 'present');
  assert.equal(statuses.い, 'present');
  assert.equal(statuses.う, undefined);
  assert.equal(statuses.き, undefined);
  assert.equal(getKeyboardStatuses(['ああああ'], 'かいうえ').か, undefined);
});

test('Bubble preserves direct green results and reveals absent neighbors', () => {
  const statuses = getKeyboardStatuses(['あいうえ'], 'あいうえ', true);
  assert.equal(statuses.あ, 'correct');
  assert.equal(statuses.い, 'correct');
  assert.equal(statuses.か, 'absent');
});
