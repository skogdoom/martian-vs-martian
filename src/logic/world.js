// One round's simulation state. Pure: no rendering, no DOM.
// `events` collects things that happened during the last step, for audio and particles.

import { createSaucer, steerSaucer, moveSaucer, bumpSaucers } from './saucer.js';

export const SIDES = ['red', 'blue'];

export function createWorld() {
  return {
    saucers: { red: createSaucer('red'), blue: createSaucer('blue') },
    events: [],
  };
}

const NO_INPUT = { x: 0, y: 0, shoot: false };

/** Advance one fixed step. `inputs` is { red, blue } of { x, y, shoot }. */
export function stepWorld(w, inputs, dt) {
  w.events.length = 0;
  const { red, blue } = w.saucers;

  for (const side of SIDES) {
    const s = w.saucers[side];
    steerSaucer(s, inputs[side] ?? NO_INPUT, dt);
    moveSaucer(s, dt);
  }

  if (bumpSaucers(red, blue)) {
    w.events.push({ type: 'bump', x: (red.x + blue.x) / 2, y: (red.y + blue.y) / 2 });
  }
}
