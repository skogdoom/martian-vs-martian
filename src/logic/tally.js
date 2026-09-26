// Running tally across matches: match wins, and the cows and lambs in each
// pen at the end of every round (stolen ones included).

import { penCounts } from './scoring.js';

export function createTally() {
  return {
    matchWins: { red: 0, blue: 0 },
    cows: { red: 0, blue: 0 },
    lambs: { red: 0, blue: 0 },
  };
}

export function addRoundToTally(t, animals) {
  for (const side of ['red', 'blue']) {
    const { cows, lambs } = penCounts(animals, side);
    t.cows[side] += cows;
    t.lambs[side] += lambs;
  }
}

export function addMatchToTally(t, match) {
  if (match.winner) t.matchWins[match.winner]++;
}
