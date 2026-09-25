// Match rules: best of 3, ties give no win, early finish when a player can't be
// caught, and two extra rounds whenever wins are level after the scheduled rounds.

import { ROUND } from '../config.js';

export function createMatch() {
  return {
    scheduled: ROUND.startRounds,
    results: [], // 'red' | 'blue' | 'tie' per round played
    wins: { red: 0, blue: 0 },
    over: false,
    winner: null,
  };
}

export function roundWinner(scores) {
  if (scores.red > scores.blue) return 'red';
  if (scores.blue > scores.red) return 'blue';
  return 'tie';
}

export function roundNumber(m) {
  return m.results.length + 1;
}

/** Record a round result. Returns 'over', 'extended' or 'continue'. */
export function recordRound(m, result) {
  if (m.over) throw new Error('match is already over');
  m.results.push(result);
  if (result !== 'tie') m.wins[result]++;

  const remaining = m.scheduled - m.results.length;
  const { red, blue } = m.wins;
  if (red > blue + remaining || blue > red + remaining) {
    m.over = true;
    m.winner = red > blue ? 'red' : 'blue';
    return 'over';
  }
  if (remaining === 0) {
    // Only reachable with level wins: anything else was caught above.
    m.scheduled += ROUND.extraRounds;
    return 'extended';
  }
  return 'continue';
}
