// Pen scores. An animal is worth full value in the pen of the player who
// first delivered it, and half value in the other pen. An animal stolen
// during a steal power-up is worth double full value until it is lifted again.
// A golden animal that paid out is worth what evened the score (golden.js).

import { ANIMALS, POWERUP } from '../config.js';

export function animalValue(a, penSide) {
  const full = ANIMALS.value[a.kind];
  if (a.goldenValue != null) return a.goldenValue;
  if (a.bonus) return full * POWERUP.stealMultiplier;
  return a.owner === penSide ? full : full / 2;
}

export function penScore(animals, side) {
  let total = 0;
  for (const a of animals) if (a.pen === side) total += animalValue(a, side);
  return total;
}

export function scores(animals) {
  return { red: penScore(animals, 'red'), blue: penScore(animals, 'blue') };
}

/** Cows and lambs currently in a pen. */
export function penCounts(animals, side) {
  const counts = { cows: 0, lambs: 0 };
  for (const a of animals) {
    if (a.pen !== side) continue;
    if (a.kind === 'cow') counts.cows++;
    else counts.lambs++;
  }
  return counts;
}

