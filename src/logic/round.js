// A round: 3-2-1 countdown with everything frozen, then the timed play phase.

import { ROUND } from '../config.js';
import { createWorld, stepWorld } from './world.js';

export function createRound(seed) {
  return {
    world: createWorld(seed),
    phase: 'countdown', // 'countdown' | 'play' | 'over'
    countdown: ROUND.countdown,
    shown: null, // last countdown number announced
    timeLeft: ROUND.length,
    events: [],
  };
}

/** Whole seconds left on the countdown, as shown on screen (3, 2, 1). */
export function countdownNumber(r) {
  return Math.ceil(r.countdown - 1e-9);
}

export function stepRound(r, inputs, dt) {
  r.events.length = 0;

  if (r.phase === 'countdown') {
    const n = countdownNumber(r);
    if (n !== r.shown) {
      r.shown = n;
      r.events.push({ type: 'countdown', n });
    }
    r.countdown = Math.max(0, r.countdown - dt);
    if (countdownNumber(r) === 0) {
      r.countdown = 0;
      r.phase = 'play';
      r.events.push({ type: 'go' });
    }
    return;
  }

  if (r.phase === 'play') {
    stepWorld(r.world, inputs, dt);
    r.events.push(...r.world.events);
    r.timeLeft = Math.max(0, r.timeLeft - dt);
    if (r.timeLeft < 1e-9) {
      r.timeLeft = 0;
      r.phase = 'over';
      r.events.push({ type: 'roundEnd' });
    }
  }
}
