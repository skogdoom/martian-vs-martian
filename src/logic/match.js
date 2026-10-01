// Match rules: best of N, ties give no win, early finish when a player can't be
// caught, and sudden death (one extra round at a time) whenever wins are level
// after the scheduled rounds.

import { ROUND } from '../config.js';

export function createMatch(rounds = ROUND.startRounds) {
  return {
    rounds, // best of
    scheduled: rounds, // rounds, plus any sudden-death ones added so far
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

/** Is the round about to be played (or being played) a sudden-death one? */
export function isSuddenDeath(m) {
  return roundNumber(m) > m.rounds;
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
