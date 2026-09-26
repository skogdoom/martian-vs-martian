// Golden animals: a rare comeback drop. If one player leads by a lot at the
// check point, a golden cow or lamb may parachute into the field. Delivered by
// the trailing player it is worth exactly enough to even the score (at least
// its normal value). Delivered by the leader it is an ordinary animal.
// Lifted out of a pen after it has paid out, it is ordinary again.

import { ANIMALS, GOLDEN } from '../config.js';
import { createAnimal, parachute } from './animal.js';
import { dropSpot } from './powerup.js';
import { scores } from './scoring.js';

/** Should a golden animal drop now? `points` is { red, blue }. */
export function shouldDropGolden(points, rng) {
  if (Math.abs(points.red - points.blue) < GOLDEN.minLead) return false;
  return rng() < GOLDEN.chance;
}

export function createGolden(rng) {
  const kind = rng() < 0.5 ? 'cow' : 'lamb';
  const a = createAnimal('golden', kind, dropSpot(kind, rng));
  a.golden = true;
  a.goldenValue = null; // set once it pays out in a pen
  parachute(a);
  return a;
}

/** A golden animal was just delivered into `pen`: work out what it is worth. */
export function settleGolden(animals, a, pen) {
  const others = scores(animals.filter((x) => x !== a));
  const deficit = others[pen === 'red' ? 'blue' : 'red'] - others[pen];
  if (deficit > 0) {
    a.goldenValue = Math.max(ANIMALS.value[a.kind], deficit);
  } else {
    a.golden = false; // the leader took it: just a cow or a lamb
  }
}

/** Lifting it out of a pen after it has paid out spends the gold. */
export function spendGolden(a) {
  if (a.goldenValue === null || a.goldenValue === undefined) return;
  a.golden = false;
  a.goldenValue = null;
}
