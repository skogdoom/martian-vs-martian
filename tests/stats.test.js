// End-of-match stats: splats per player and times dazed.

import { describe, it, expect } from 'vitest';
import { STEP, COMBAT } from '../src/config.js';
import { createWorld, stepWorld } from '../src/logic/world.js';
import { createMatch, addRoundStats } from '../src/logic/match.js';
import { grantPower } from '../src/logic/powerup.js';
import { SHOOT, run, stepUntil, hover } from './helpers.js';

/** Red carries a cow, high up; blue is level with it to the right. */
function redCarriesHigh() {
  const w = createWorld(2);
  const cow = w.animals.find((a) => a.kind === 'cow' && a.state === 'field');
  hover(w.saucers.blue, 1100, 60);
  hover(w.saucers.red, cow.x);
  stepUntil(w, {}, 3, (e) => e.type === 'pickup' && e.side === 'red');
  hover(w.saucers.red, 640, 150);
  hover(w.saucers.blue, 900, 150);
  return { w, cow };
}

describe('splats', () => {
  it('count for the player whose beam it fell from, even when the other knocked it loose', () => {
    const { w } = redCarriesHigh();
    stepUntil(w, { blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'knockLoose');
    expect(stepUntil(w, {}, 3, (e) => e.type === 'splat')).toMatchObject({ kind: 'cow', side: 'red' });
    expect(w.stats.red).toMatchObject({ cowsSplatted: 1, lambsSplatted: 0 });
    expect(w.stats.blue).toMatchObject({ cowsSplatted: 0, lambsSplatted: 0 });
  });

  it('and when let go of by hand', () => {
    const { w } = redCarriesHigh();
    stepWorld(w, SHOOT, STEP);
    stepUntil(w, {}, 3, (e) => e.type === 'splat');
    expect(w.stats.red.cowsSplatted).toBe(1);
  });
});

describe('times dazed', () => {
  it('three hits in a row count once', () => {
    const w = createWorld(1);
    hover(w.saucers.red, 300, 200);
    hover(w.saucers.blue, 900, 200);
    for (let i = 0; i < COMBAT.dazeHits; i++) {
      stepUntil(w, { red: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'hit');
      hover(w.saucers.blue, 900, 200);
      run(w, {}, 0.3);
    }
    expect(w.stats.blue.dazed).toBe(1);
    expect(w.stats.red.dazed).toBe(0);
  });

  it('a ram counts for the one rammed, not when a shield stops it', () => {
    for (const shield of [false, true]) {
      const w = createWorld(1);
      if (shield) grantPower(w.powers, 'blue', 'shield');
      hover(w.saucers.red, 100, 300);
      hover(w.saucers.blue, 900, 300);
      const ram = stepUntil(w, { red: { x: 1, y: 0 } }, 4, (e) => e.type === 'ram');
      expect(ram).toMatchObject({ victim: 'blue' });
      expect(Boolean(ram.shielded)).toBe(shield);
      expect(w.stats.blue.dazed).toBe(shield ? 0 : 1);
      expect(w.stats.red.dazed).toBe(0);
    }
  });

  it('a rocket hit counts', () => {
    const w = createWorld(1);
    hover(w.saucers.red, 300, 200);
    hover(w.saucers.blue, 700, 200);
    grantPower(w.powers, 'red', 'rocket');
    stepWorld(w, SHOOT, STEP);
    stepUntil(w, {}, 3, (e) => e.type === 'hit' && e.rocket);
    expect(w.stats.blue.dazed).toBe(1);
  });
});

describe('match stats', () => {
  it('add up over the rounds and start at zero', () => {
    const m = createMatch(3);
    expect(m.stats.red).toEqual({ cowsSplatted: 0, lambsSplatted: 0, dazed: 0 });
    addRoundStats(m, { red: { cowsSplatted: 1, lambsSplatted: 2, dazed: 3 }, blue: { cowsSplatted: 0, lambsSplatted: 1, dazed: 0 } });
    addRoundStats(m, { red: { cowsSplatted: 1, lambsSplatted: 0, dazed: 1 }, blue: { cowsSplatted: 2, lambsSplatted: 0, dazed: 4 } });
    expect(m.stats).toEqual({
      red: { cowsSplatted: 2, lambsSplatted: 2, dazed: 4 },
      blue: { cowsSplatted: 2, lambsSplatted: 1, dazed: 4 },
    });
  });
});
