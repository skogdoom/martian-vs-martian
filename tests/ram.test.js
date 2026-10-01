import { describe, it, expect } from 'vitest';
import { STEP, ARENA, SAUCER, RAM } from '../src/config.js';
import { createSaucer, steerSaucer, moveSaucer, momentum, speed } from '../src/logic/saucer.js';
import { createWorld, stepWorld } from '../src/logic/world.js';
import { grantPower } from '../src/logic/powerup.js';

const LOW = ARENA.flightBottom - 10;
const FULL = RAM.delay + RAM.build;

function fly(s, input, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) {
    steerSaucer(s, input, STEP);
    moveSaucer(s, STEP);
  }
}

function run(w, inputs, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) stepWorld(w, inputs, STEP);
}

function stepUntil(w, inputs, seconds, pred) {
  for (let t = 0; t < seconds; t += STEP) {
    stepWorld(w, inputs, STEP);
    const e = w.events.find(pred);
    if (e) return e;
  }
  return null;
}

function hover(s, x, y = LOW) {
  Object.assign(s, { x, y, vx: 0, vy: 0 });
}

describe('momentum', () => {
  it('builds while flying straight, raising the top speed', () => {
    const s = createSaucer('red');
    s.x = 60;
    fly(s, { x: 1, y: 0 }, 0.4);
    expect(momentum(s)).toBe(0);
    expect(speed(s)).toBeLessThanOrEqual(SAUCER.maxSpeed + 1e-6);
    fly(s, { x: 1, y: 0 }, FULL);
    expect(momentum(s)).toBe(1);
    expect(speed(s)).toBeGreaterThan(SAUCER.maxSpeed * 1.35);
    expect(speed(s)).toBeLessThanOrEqual(SAUCER.maxSpeed * RAM.boost + 1e-6);
    expect(speed(s)).toBeGreaterThan(RAM.speed);
  });

  /** A saucer at full momentum, flying right from the left wall at y. */
  function atFullMomentum(y = 150) {
    const s = createSaucer('red');
    Object.assign(s, { x: 60, y });
    fly(s, { x: 1, y: 0 }, FULL + 0.4);
    expect(momentum(s)).toBe(1);
    return s;
  }

  it('is kept when diving: turning down, or down alone', () => {
    for (const dive of [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]) {
      const s = atFullMomentum();
      fly(s, dive, 0.5);
      expect(momentum(s)).toBe(1);
      expect(speed(s)).toBeGreaterThan(RAM.speed);
      // And back to level flight.
      fly(s, { x: 1, y: 0 }, 0.2);
      expect(momentum(s)).toBe(1);
    }
  });

  it('is lost by pressing up, turning back or letting go', () => {
    for (const input of [
      { x: 1, y: -1 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 0 },
    ]) {
      const s = atFullMomentum();
      fly(s, input, STEP);
      expect(s.streak).toBe(0);
    }
  });

  it('does not build while carrying', () => {
    const s = createSaucer('red');
    s.x = 60;
    for (let t = 0; t < FULL + 0.4; t += STEP) {
      steerSaucer(s, { x: 1, y: 0 }, STEP, { momentum: false });
      moveSaucer(s, STEP);
    }
    expect(momentum(s)).toBe(0);
    expect(speed(s)).toBeLessThanOrEqual(SAUCER.maxSpeed + 1e-6);
  });

  it('is lost against a wall', () => {
    const s = createSaucer('red');
    s.x = 900;
    fly(s, { x: 1, y: 0 }, 3);
    expect(s.x).toBe(1280 - SAUCER.radius);
    expect(momentum(s)).toBe(0);
  });
});

describe('momentum and shots', () => {
  /** Red flies right at full momentum at y 300; blue waits ahead or behind. */
  function running(blueX) {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    hover(red, 60, 300);
    hover(blue, blueX, 300);
    run(w, { red: { x: 1, y: 0 } }, FULL + 0.4);
    expect(momentum(red)).toBe(1);
    return { w, red, blue };
  }

  it('a shot that knocks the saucer off its course costs the momentum', () => {
    const { w, red } = running(1240);
    const hit = stepUntil(w, { red: { x: 1, y: 0 }, blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'hit');
    expect(hit).toMatchObject({ side: 'red' });
    expect(w.events.some((e) => e.type === 'momentumLost' && e.side === 'red')).toBe(true);
    expect(red.streak).toBe(0);
    run(w, { red: { x: 1, y: 0 } }, 0.3);
    expect(momentum(red)).toBe(0);
  });

  it('a shot from behind, pushing it on its way, does not', () => {
    const { w, red, blue } = running(1240);
    hover(blue, red.x - 300, 300);
    stepUntil(w, { red: { x: 1, y: 0 }, blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'hit');
    expect(w.events.some((e) => e.type === 'momentumLost')).toBe(false);
    expect(momentum(red)).toBe(1);
  });

  it('the laser pushing it back costs it too', () => {
    const { w, red } = running(1240);
    red.x = 200; // room to be pushed back before reaching blue
    grantPower(w.powers, 'blue', 'laser');
    // It slows it below cruising speed (or turns it back) within a moment.
    run(w, { red: { x: 1, y: 0 }, blue: { x: 0, y: 0, fire: true } }, 0.3);
    expect(red.streak).toBe(0);
  });
});

describe('ramming', () => {
  /** Blue carries a cow at (900, 300); red is lined up to the left. */
  function setup(gap) {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    const cow = w.animals.find((a) => a.kind === 'cow');
    hover(blue, cow.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    hover(blue, 900, 300);
    hover(red, 900 - gap, 300);
    return { w, red, blue, cow };
  }

  it('at full momentum, knocks the animal loose and dazes the opponent', () => {
    const { w, blue, cow } = setup(820);
    const ram = stepUntil(w, { red: { x: 1, y: 0 } }, 4, (e) => e.type === 'ram');
    expect(ram).toMatchObject({ side: 'red', victim: 'blue' });
    expect(w.events.some((e) => e.type === 'bump')).toBe(true);
    expect(w.events.find((e) => e.type === 'knockLoose')).toMatchObject({ side: 'blue', kind: 'cow' });
    expect(w.hooks.blue.carrying).toBe(null);
    expect(cow.state).toBe('falling');
    expect(blue.stun).toBeCloseTo(RAM.daze, 5);
    expect(blue.vx).toBeGreaterThan(RAM.knockback * 0.5);
    expect(w.saucers.red.streak).toBe(0);
  });

  it('a slow bump does nothing of the sort', () => {
    const { w, blue, cow } = setup(200);
    const bump = stepUntil(w, { red: { x: 1, y: 0 } }, 2, (e) => e.type === 'bump');
    expect(bump).toBeTruthy();
    expect(w.events.some((e) => e.type === 'ram')).toBe(false);
    expect(w.hooks.blue.carrying).toBe(cow);
    expect(blue.stun).toBe(0);
  });

  it('breaks a pickup in progress', () => {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    hover(blue, 1200, 100);
    hover(red, 60);
    const go = { red: { x: 1, y: 0 } };
    run(w, go, 1);
    // Blue starts lifting a lamb a little way ahead of red's run.
    const lamb = w.animals.find((a) => a.kind === 'lamb' && a.x - red.x > 350 && a.x - red.x < 520);
    hover(blue, lamb.x);
    expect(stepUntil(w, go, 2, (e) => e.type === 'ram')).toBeTruthy();
    expect(w.events.find((e) => e.type === 'interrupt')).toMatchObject({ side: 'blue', reason: 'ram' });
    expect(lamb.state).toBe('falling');
    // Dazed: no new pickup until it wears off.
    run(w, {}, RAM.daze - 0.2);
    expect(w.hooks.blue.target).toBe(null);
  });

  it('a carrier cannot ram, even with the speed power-up', () => {
    const { w, red, blue } = setup(820);
    // Red carries a lamb too.
    const lamb = w.animals.find((a) => a.kind === 'lamb' && a.state === 'field');
    Object.assign(lamb, { state: 'carried', hookedBy: 'red' });
    w.hooks.red.carrying = lamb;
    grantPower(w.powers, 'red', 'speed');
    const bump = stepUntil(w, { red: { x: 1, y: 0 } }, 4, (e) => e.type === 'bump');
    expect(bump).toBeTruthy();
    expect(w.events.some((e) => e.type === 'ram')).toBe(false);
    expect(blue.stun).toBe(0);
    expect(w.hooks.blue.carrying).not.toBe(null);
    expect(red.streak).toBe(0);
  });

  it('bounces off a shield', () => {
    const { w, blue, cow } = setup(820);
    grantPower(w.powers, 'blue', 'shield');
    const ram = stepUntil(w, { red: { x: 1, y: 0 } }, 4, (e) => e.type === 'ram');
    expect(ram).toMatchObject({ shielded: true });
    expect(w.hooks.blue.carrying).toBe(cow);
    expect(blue.stun).toBe(0);
  });

  it('head on at full speed, both are dazed', () => {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    hover(red, 60, 300);
    hover(blue, 1220, 300);
    const e = stepUntil(w, { red: { x: 1, y: 0 }, blue: { x: -1, y: 0 } }, 4, (e) => e.type === 'ram');
    expect(e).toBeTruthy();
    expect(w.events.filter((x) => x.type === 'ram')).toHaveLength(2);
    expect(red.stun).toBeGreaterThan(0);
    expect(blue.stun).toBeGreaterThan(0);
  });
});
