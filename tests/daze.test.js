import { describe, it, expect } from 'vitest';
import { STEP, COMBAT, POWERUP } from '../src/config.js';
import { createWorld, stepWorld } from '../src/logic/world.js';
import { grantPower } from '../src/logic/powerup.js';
import { SHOOT, run } from './helpers.js';

function hover(s, x, y) {
  Object.assign(s, { x, y, vx: 0, vy: 0 });
}

/** Red shoots blue from 300 px away; returns this volley's events once it lands. */
function shootOnce(w) {
  hover(w.saucers.red, 400, 300);
  hover(w.saucers.blue, 700, 300);
  w.weapons.red.clip = COMBAT.clipSize;
  w.weapons.red.reload = 0;
  w.weapons.red.cooldown = 0;
  stepWorld(w, SHOOT, STEP);
  const events = [];
  for (let t = 0; t < 1 && !events.some((e) => e.type === 'hit'); t += STEP) {
    stepWorld(w, {}, STEP);
    events.push(...w.events);
  }
  return events;
}

function setup() {
  const w = createWorld(1);
  return { w, blue: w.saucers.blue };
}

describe('three hits in a row', () => {
  it('daze the saucer', () => {
    const { w, blue } = setup();
    expect(shootOnce(w).some((e) => e.type === 'dazed')).toBe(false);
    expect(shootOnce(w).some((e) => e.type === 'dazed')).toBe(false);
    const third = shootOnce(w);
    expect(third.find((e) => e.type === 'dazed')).toMatchObject({ side: 'blue' });
    expect(blue.stun).toBeGreaterThan(COMBAT.dazeTime - 0.1);
    expect(blue.hits).toBe(0);
  });

  it('only when each comes soon after the last', () => {
    const { w, blue } = setup();
    for (let i = 0; i < 4; i++) {
      shootOnce(w);
      run(w, {}, COMBAT.dazeWindow + 0.1);
    }
    expect(blue.stun).toBe(0);
    expect(blue.hits).toBe(1);
  });

  it('a triple-shot volley counts as one hit', () => {
    const { w, blue } = setup();
    grantPower(w.powers, 'red', 'triple');
    hover(w.saucers.red, 400, 300);
    hover(blue, 700, 300 + POWERUP.tripleSpread / 2); // between two of the three shots
    stepWorld(w, SHOOT, STEP);
    const events = [];
    for (let t = 0; t < 1; t += STEP) {
      stepWorld(w, {}, STEP);
      events.push(...w.events);
    }
    expect(events.filter((e) => e.type === 'hit').length).toBeGreaterThanOrEqual(2);
    expect(blue.hits).toBe(1);
    expect(blue.stun).toBe(0);
  });

  it('shots that bounce off a shield do not count', () => {
    const { w, blue } = setup();
    grantPower(w.powers, 'blue', 'shield');
    for (let i = 0; i < 3; i++) shootOnce(w);
    expect(blue.hits).toBe(0);
    expect(blue.stun).toBe(0);
  });

  it('hits while dazed, and just after, do not count toward the next', () => {
    const { w, blue } = setup();
    for (let i = 0; i < 3; i++) shootOnce(w);
    expect(blue.stun).toBeGreaterThan(0);
    shootOnce(w);
    shootOnce(w);
    expect(blue.hits).toBe(0);
    run(w, {}, COMBAT.dazeTime + COMBAT.dazeGrace);
    shootOnce(w);
    expect(blue.hits).toBe(1);
  });
});
