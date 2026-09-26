import { describe, it, expect, afterEach } from 'vitest';
import { STEP, ARENA, COMBAT, POWERUP } from '../src/config.js';
import { createWorld, stepWorld } from '../src/logic/world.js';
import { grantPower } from '../src/logic/powerup.js';
import { clampToPen } from '../src/logic/animal.js';
import { scores } from '../src/logic/scoring.js';

const LOW = ARENA.flightBottom - 10;
const life = POWERUP.rocketLife;
afterEach(() => {
  POWERUP.rocketLife = life;
});

function stepUntil(w, inputs, seconds, pred) {
  for (let t = 0; t < seconds; t += STEP) {
    stepWorld(w, inputs, STEP);
    const e = w.events.find(pred);
    if (e) return e;
  }
  return null;
}

function run(w, inputs, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) stepWorld(w, inputs, STEP);
}

function place(s, x, y) {
  Object.assign(s, { x, y, vx: 0, vy: 0 });
}

const SHOOT = { red: { x: 0, y: 0, shoot: true } };

describe('single-use power-ups', () => {
  it('wait to be used instead of running out', () => {
    const w = createWorld(1);
    grantPower(w.powers, 'red', 'rocket');
    run(w, {}, POWERUP.duration + 2);
    expect(w.powers.red?.type).toBe('rocket');
  });
});

describe('homing rocket', () => {
  it('replaces the next shot, once, and costs no ammo', () => {
    const w = createWorld(1);
    grantPower(w.powers, 'red', 'rocket');
    stepWorld(w, SHOOT, STEP);
    expect(w.events.some((e) => e.type === 'rocketLaunch')).toBe(true);
    expect(w.rockets).toHaveLength(1);
    expect(w.projectiles).toHaveLength(0);
    expect(w.powers.red).toBe(null);
    expect(w.weapons.red.ammo).toBe(COMBAT.ammoPerRound);
  });

  it('homes in on an opponent at another height, knocks it back and knocks its animal loose', () => {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    const cow = w.animals.find((a) => a.kind === 'cow');
    place(blue, cow.x, LOW);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    place(blue, 900, 150);
    place(red, 300, 420);
    grantPower(w.powers, 'red', 'rocket');
    const hit = stepUntil(w, SHOOT, 4, (e) => e.type === 'hit');
    expect(hit).toMatchObject({ side: 'blue', rocket: true });
    expect(w.events.some((e) => e.type === 'knockLoose')).toBe(true);
    expect(w.hooks.blue.carrying).toBe(null);
    expect(Math.abs(blue.vx)).toBeGreaterThan(COMBAT.knockback);
  });

  it('stuns the saucer it hits for a moment', () => {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    place(red, 300, 250);
    place(blue, 800, 250);
    grantPower(w.powers, 'red', 'rocket');
    stepWorld(w, SHOOT, STEP); // one press: the rocket, not a bullet after it
    stepUntil(w, {}, 3, (e) => e.type === 'hit');
    expect(blue.stun).toBeGreaterThan(POWERUP.rocketStun - 0.1);
    // Its controls do nothing, and it cannot shoot.
    const before = w.projectiles.length;
    stepWorld(w, { blue: { x: -1, y: -1, shoot: true } }, STEP);
    expect(w.projectiles.length).toBe(before);
    run(w, {}, POWERUP.rocketStun);
    expect(blue.stun).toBe(0);
    stepWorld(w, { blue: { x: 0, y: 0, shoot: true } }, STEP);
    expect(w.events.some((e) => e.type === 'shot' && e.side === 'blue')).toBe(true);
  });

  it('burns out if it cannot reach the target in time', () => {
    POWERUP.rocketLife = 0.3;
    const w = createWorld(1);
    place(w.saucers.red, 100, 200);
    place(w.saucers.blue, 1200, 200);
    grantPower(w.powers, 'red', 'rocket');
    const e = stepUntil(w, SHOOT, 1, (e) => e.type === 'explosion');
    expect(e.big).toBe(false);
    expect(w.rockets).toHaveLength(0);
    expect(w.saucers.blue.vx).toBe(0);
  });
});

describe('twin beam', () => {
  function withTwoLambs() {
    const w = createWorld(1);
    place(w.saucers.blue, 1000, 100);
    const [a, b] = w.animals.filter((x) => x.kind === 'lamb');
    return { w, a, b, red: w.saucers.red };
  }

  it('carries a second animal, and delivers both', () => {
    const { w, a, b, red } = withTwoLambs();
    grantPower(w.powers, 'red', 'twin');
    place(red, a.x, LOW);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    place(red, b.x, LOW);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    expect(w.hooks.red.carrying).toBe(a);
    expect(w.hooks.red.second).toBe(b);
    expect(b.y).toBeGreaterThan(a.y); // hangs below
    red.x = 90;
    run(w, {}, 1.5);
    expect([a.pen, b.pen]).toEqual(['red', 'red']);
    expect(scores(w.animals).red).toBe(2);
  });

  it('without it, the saucer carries one', () => {
    const { w, a, b, red } = withTwoLambs();
    place(red, a.x, LOW);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    place(red, b.x, LOW);
    run(w, {}, 1.5);
    expect(w.hooks.red.second).toBe(null);
    expect(b.state).toBe('field');
  });

  it('a hit knocks the lower animal loose first', () => {
    const { w, a, b, red } = withTwoLambs();
    grantPower(w.powers, 'red', 'twin');
    place(red, a.x, LOW);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    place(red, b.x, LOW);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    place(red, 500, 300);
    place(w.saucers.blue, 750, 300);
    stepUntil(w, { blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'knockLoose');
    expect(w.hooks.red.carrying).toBe(a);
    expect(w.hooks.red.second).toBe(null);
    expect(b.state).toBe('falling');
  });
});

describe('pen bomb', () => {
  /** Blue has three cows in its pen; red holds the bomb above `x`. */
  function setup(x) {
    const w = createWorld(3);
    const cows = w.animals.filter((a) => a.kind === 'cow').slice(0, 3);
    cows.forEach((a, i) => Object.assign(a, { state: 'penned', pen: 'blue', owner: 'blue', vx: 0, x: clampToPen(1130 + i * 40, 'cow', 'blue') }));
    place(w.saucers.red, x, 300);
    place(w.saucers.blue, 640, 100);
    grantPower(w.powers, 'red', 'bomb');
    return { w, cows };
  }

  it('dropped in the opponent pen, throws some of its animals back into the field', () => {
    const { w, cows } = setup(1190);
    stepWorld(w, SHOOT, STEP);
    expect(w.powers.red).toBe(null);
    expect(w.bombs).toHaveLength(1);
    const blast = stepUntil(w, {}, 2, (e) => e.type === 'bombBlast');
    expect(blast.pen).toBe('blue');
    expect(blast.count).toBeGreaterThanOrEqual(1);
    expect(blast.count).toBeLessThanOrEqual(3);
    run(w, {}, 3);
    const out = cows.filter((a) => a.pen !== 'blue');
    expect(out).toHaveLength(blast.count);
    for (const a of out) {
      expect(a.state).toBe('field');
      expect(a.x).toBeGreaterThan(ARENA.pens.red.right);
      expect(a.x).toBeLessThan(ARENA.pens.blue.left);
      expect(a.owner).toBe('blue'); // still theirs to bring back
    }
    expect(scores(w.animals).blue).toBe(2 * (3 - blast.count));
  });

  it('sets the animals it throws on fire, until a beam picks them up', () => {
    const { w, cows } = setup(1190);
    stepWorld(w, SHOOT, STEP);
    stepUntil(w, {}, 2, (e) => e.type === 'bombBlast');
    run(w, {}, 3);
    const burning = cows.filter((a) => a.onFire);
    expect(burning.length).toBeGreaterThanOrEqual(1);
    expect(cows.filter((a) => a.pen === 'blue').every((a) => !a.onFire)).toBe(true);
    const a = burning[0];
    place(w.saucers.red, a.x, ARENA.flightBottom - 10);
    expect(stepUntil(w, {}, 1, (e) => e.type === 'extinguish')).toBeTruthy();
    expect(a.onFire).toBe(false);
    expect(w.hooks.red.target).toBe(a);
  });

  it('does nothing when dropped in the field', () => {
    const { w } = setup(640);
    stepWorld(w, SHOOT, STEP);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'bombBlast')).toMatchObject({ pen: null, count: 0 });
    expect(scores(w.animals).blue).toBe(6);
  });

  it('can backfire on your own pen', () => {
    const w = createWorld(3);
    const lamb = w.animals.find((a) => a.kind === 'lamb');
    Object.assign(lamb, { state: 'penned', pen: 'red', owner: 'red', vx: 0, x: 90 });
    place(w.saucers.red, 90, 300);
    grantPower(w.powers, 'red', 'bomb');
    stepWorld(w, SHOOT, STEP);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'bombBlast')).toMatchObject({ pen: 'red', count: 1 });
  });
});
