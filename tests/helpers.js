// Small helpers shared by the tests.

import { STEP, ARENA } from '../src/config.js';
import { stepWorld } from '../src/logic/world.js';

/** Hover height for hooking things on the ground. */
export const LOW = ARENA.flightBottom - 10;

/** Red's shoot key, pressed for one step. */
export const SHOOT = { red: { x: 0, y: 0, shoot: true } };

/** Step the world for `seconds`. */
export function run(w, inputs, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) stepWorld(w, inputs, STEP);
}

/** Step until an event matches `pred`, for at most `seconds`. Returns the event or null. */
export function stepUntil(w, inputs, seconds, pred) {
  for (let t = 0; t < seconds; t += STEP) {
    stepWorld(w, inputs, STEP);
    const e = w.events.find(pred);
    if (e) return e;
  }
  return null;
}

/** All events of the given types over `seconds`. */
export function collect(w, inputs, seconds, types) {
  const found = [];
  for (let t = 0; t < seconds - 1e-9; t += STEP) {
    stepWorld(w, inputs, STEP);
    found.push(...w.events.filter((e) => types.includes(e.type)));
  }
  return found;
}

/** Put a saucer at (x, y), still. */
export function hover(s, x, y = LOW) {
  Object.assign(s, { x, y, vx: 0, vy: 0 });
}
