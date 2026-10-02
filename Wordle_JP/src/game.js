import { splitKana } from './kana.js';

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

export function getKeyboardStatuses(guesses, target) {
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
  return statuses;
}

export function getRoundOutcome(guesses, target) {
  if (!target) return null;
  if (guesses.includes(target)) return 'won';
  return guesses.length >= MAX_GUESSES ? 'lost' : null;
}
