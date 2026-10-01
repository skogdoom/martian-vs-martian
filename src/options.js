// Options chosen on the title screen and in the settings menu: round length,
// number of rounds and whether to keep the game area 16:9.
// Remembered between visits in localStorage (every access is guarded: it can
// be missing, blocked or full, and the game must work without it).

import { ROUND, COMBAT } from './config.js';

export const LENGTHS = [60, 90, 120]; // seconds
export const ROUNDS = [1, 3, 5, 7]; // best of
export const DEFAULT_OPTIONS = { length: ROUND.length, rounds: ROUND.startRounds, ratio169: false };

/** Shots per round for a round length: the 90 s value, scaled to the length. */
export function ammoFor(length) {
  return Math.round((COMBAT.ammoPerRound * length) / ROUND.length);
}

const KEY = 'martian-vs-martian.options';

/** The next value in `list` after `value`, one step in `dir` (-1/+1), stopping at the ends. */
export function step(list, value, dir) {
  const i = list.indexOf(value);
  return list[Math.max(0, Math.min(list.length - 1, (i < 0 ? list.indexOf(DEFAULT_OPTIONS.length) : i) + dir))];
}

/** Check a stored value; anything not on offer falls back to the default. */
export function sanitize(o) {
  return {
    length: LENGTHS.includes(o?.length) ? o.length : DEFAULT_OPTIONS.length,
    rounds: ROUNDS.includes(o?.rounds) ? o.rounds : DEFAULT_OPTIONS.rounds,
    ratio169: o?.ratio169 === true,
  };
}

/** The options held in a session, ready to save. */
export function pickOptions(session) {
  return { length: session.length, rounds: session.rounds, ratio169: session.ratio169 };
}

export function loadOptions(storage = globalThis.localStorage) {
  try {
    return sanitize(JSON.parse(storage.getItem(KEY)));
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

export function saveOptions(options, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(options));
  } catch {
    // not remembered: nothing to do
  }
}
