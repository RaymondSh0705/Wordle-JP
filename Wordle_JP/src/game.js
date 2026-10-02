import { splitKana } from './kana.js';
import { KANA_ROWS } from './keyboardLayout.js';

export const MAX_GUESSES = 6;

export function scoreGuess(guess, target) {
  const letters = splitKana(guess);
  const answer = splitKana(target);
  const remaining = new Map();
  const scores = letters.map((kana, index) => kana === answer[index] ? 'correct' : 'absent');
  answer.forEach((kana, index) => {
    if (scores[index] !== 'correct') remaining.set(kana, (remaining.get(kana) ?? 0) + 1);
  });
  letters.forEach((kana, index) => {
    if (scores[index] !== 'correct' && remaining.get(kana) > 0) {
      scores[index] = 'present';
      remaining.set(kana, remaining.get(kana) - 1);
    }
  });
  return scores;
}

export function getAdjacentKana(kana) {
  for (let row = 0; row < KANA_ROWS.length; row += 1) {
    const column = KANA_ROWS[row].indexOf(kana);
    if (column === -1) continue;
    return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
      .map(([r, c]) => KANA_ROWS[r]?.[c]).filter(Boolean);
  }
  return [];
}

export function getKeyboardStatuses(guesses, target, bubble = false) {
  const statuses = {};
  const priority = { absent: 1, present: 2, correct: 3 };
  for (const guess of guesses) {
    const scores = scoreGuess(guess, target);
    splitKana(guess).forEach((kana, index) => {
      if ((priority[statuses[kana]] ?? 0) < priority[scores[index]]) {
        statuses[kana] = scores[index];
      }
    });
  }
  if (bubble) {
    const answer = new Set(splitKana(target));
    for (const kana of new Set(guesses.flatMap(splitKana))) {
      for (const neighbor of getAdjacentKana(kana)) {
        const status = answer.has(neighbor) ? 'present' : 'absent';
        if ((priority[statuses[neighbor]] ?? 0) < priority[status]) statuses[neighbor] = status;
      }
    }
  }
  return statuses;
}

export function getRoundOutcome(guesses, target) {
  if (!target) return null;
  if (guesses.includes(target)) return 'won';
  return guesses.length >= MAX_GUESSES ? 'lost' : null;
}
