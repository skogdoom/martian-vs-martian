// What lives for the page: the chosen mode, CPU difficulty, the match in
// progress and a tally per mode. Reloading the page resets it.

import { createMatch } from './logic/match.js';
import { createTally } from './logic/tally.js';

export const DIFFICULTIES = ['easy', 'normal', 'hard'];

export function createSession() {
  return {
    players: 2, // 1: Red against the CPU, 2: Red against Blue
    difficulty: 'normal',
    tallies: {}, // one per mode, e.g. '2p', '1p-hard'
    tally: null,
    match: null,
  };
}

/** Start a new match in the session's current mode. */
export function startMatch(session) {
  const key = session.players === 1 ? `1p-${session.difficulty}` : '2p';
  session.tally = session.tallies[key] ??= createTally();
  session.match = createMatch();
}

export function isCpu(session, side) {
  return session.players === 1 && side === 'blue';
}

/** How a side is named on screen. */
export function sideName(session, side) {
  if (isCpu(session, side)) return 'CPU';
  return side.toUpperCase();
}

/** A short description of the mode, e.g. "1 PLAYER vs CPU (HARD)". */
export function modeName(session) {
  return session.players === 1 ? `1 PLAYER vs CPU (${session.difficulty.toUpperCase()})` : '2 PLAYERS';
}
