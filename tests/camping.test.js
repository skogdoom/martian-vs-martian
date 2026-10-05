import { describe, it, expect } from 'vitest';
import { STEP, ARENA, SAUCER, RESTOCK, SPOOK, SPLAT, ANIMALS } from '../src/config.js';
import { createWorld, stepWorld } from '../src/logic/world.js';
import { clampToPen } from '../src/logic/animal.js';
import { LOW, SHOOT, run, stepUntil } from './helpers.js';

const HERD = ANIMALS.cows + ANIMALS.lambs; // the starting herd

function place(s, x, y, vx = 0, vy = 0) {
  Object.assign(s, { x, y, vx, vy });
}

/** Red has lifted a lamb; blue is parked out of the way. */
function carrying() {
  const w = createWorld(1);
  place(w.saucers.blue, 640, 100);
  const a = w.animals.find((b) => b.kind === 'lamb');
  place(w.saucers.red, a.x, LOW);
  stepUntil(w, {}, 2, (e) => e.type === 'pickup');
  return { w, a, red: w.saucers.red };
}

describe('throwing', () => {
  it('a released animal keeps the saucer speed and can be lobbed into your pen', () => {
    const { w, a, red } = carrying();
    // Flying left at full speed, 150 px short of the pen.
    place(red, ARENA.pens.red.right + 150, 420, -SAUCER.maxSpeed);
    stepWorld(w, SHOOT, STEP);
    expect(a.vx).toBeLessThan(-SAUCER.maxSpeed * 0.9);
    const land = stepUntil(w, {}, 2, (e) => e.type === 'land' || e.type === 'splat');
    expect(land).toMatchObject({ type: 'land', pen: 'red', delivered: true });
  });

  it('a throw that lands in the opponent pen is not a delivery', () => {
    const { w, a, red } = carrying();
    place(red, ARENA.pens.blue.left - 150, 420, SAUCER.maxSpeed);
    stepWorld(w, SHOOT, STEP);
    const land = stepUntil(w, {}, 2, (e) => e.type === 'land');
    expect(land).toMatchObject({ pen: 'blue', delivered: false });
    expect(a.owner).toBe('blue'); // a gift: blue had never delivered it
  });

  it('thrown upward, it falls from the top of its arc', () => {
    const { w, a, red } = carrying();
    // Safe height on release, but climbing fast.
    place(red, 640, 460, 0, -SAUCER.maxSpeed);
    expect(ARENA.groundY - (red.y + 60)).toBeLessThan(SPLAT.height);
    stepWorld(w, SHOOT, STEP);
    stepWorld(w, {}, STEP);
    expect(a.vy).toBeLessThan(0);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land' || e.type === 'splat')?.type).toBe('land');
    // From higher up the same climb is too much.
    const again = carrying();
    place(again.red, 640, 400, 0, -SAUCER.maxSpeed);
    stepWorld(again.w, SHOOT, STEP);
    expect(stepUntil(again.w, {}, 2, (e) => e.type === 'land' || e.type === 'splat')?.type).toBe('splat');
  });

  it('stops at the arena walls', () => {
    const { w, a, red } = carrying();
    place(red, 60, 440, -SAUCER.maxSpeed);
    stepWorld(w, SHOOT, STEP);
    stepUntil(w, {}, 2, (e) => e.type === 'land');
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.pen).toBe('red');
  });

  it('a hit knocks the animal off with the saucer speed from before the hit', () => {
    const { w, a, red } = carrying();
    place(red, 500, 440, 100);
    place(w.saucers.blue, 750, 440);
    stepUntil(w, { blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'knockLoose');
    expect(a.vx).toBeGreaterThan(50);
    expect(a.vx).toBeLessThan(200); // not the 900 px/s knockback
  });

  it('the automatic release over your pen is still straight down', () => {
    const { w, a, red } = carrying();
    place(red, ARENA.pens.red.right - 20, LOW, -150);
    stepUntil(w, {}, 1, (e) => e.type === 'deliver');
    expect(a.vx).toBe(0);
  });
});

describe('field restock', () => {
  it('parachutes in fresh animals once the field has stood empty for a while', () => {
    const w = createWorld(1);
    place(w.saucers.red, 640, 100);
    place(w.saucers.blue, 700, 100);
    w.animals.forEach((a, i) => Object.assign(a, { state: 'penned', pen: i % 2 ? 'red' : 'blue', owner: i % 2 ? 'red' : 'blue' }));
    run(w, {}, RESTOCK.emptyFieldAfter - 0.5);
    expect(w.animals).toHaveLength(HERD);
    const e = stepUntil(w, {}, 1, (e) => e.type === 'restock');
    expect(e).toMatchObject({ count: RESTOCK.emptyFieldCount, reason: 'emptyField' });
    expect(w.animals.slice(HERD).every((a) => a.state === 'descending')).toBe(true);
    // Not again while they are around.
    run(w, {}, RESTOCK.emptyFieldAfter + 1);
    expect(w.animals).toHaveLength(HERD + RESTOCK.emptyFieldCount);
  });

  it('does not restock while there are animals in the field', () => {
    const w = createWorld(1);
    run(w, {}, RESTOCK.emptyFieldAfter + 1);
    expect(w.animals).toHaveLength(HERD);
  });
});

describe('spooked pens', () => {
  function campingRed() {
    const w = createWorld(1);
    place(w.saucers.blue, 640, 100);
    const herd = w.animals.filter((a) => a.kind === 'cow').slice(0, 3);
    herd.forEach((a, i) => Object.assign(a, { state: 'penned', pen: 'red', owner: 'red', vx: 0, x: clampToPen(40 + i * 45, a.kind, 'red') }));
    place(w.saucers.red, 90, 300);
    return { w, herd };
  }

  it('a saucer hovering over its own pen spooks the animals out, one at a time', () => {
    const { w, herd } = campingRed();
    run(w, {}, SPOOK.after - 0.2);
    expect(herd.every((a) => a.state === 'penned')).toBe(true);
    const first = stepUntil(w, {}, 0.5, (e) => e.type === 'spooked');
    expect(first).toMatchObject({ side: 'red' });
    const second = stepUntil(w, {}, SPOOK.every + 0.1, (e) => e.type === 'spooked');
    expect(second).toBeTruthy();
    run(w, {}, 2);
    const out = herd.filter((a) => a.pen !== 'red');
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (const a of out) {
      expect(a.state).toBe('field'); // landed safely, not splatted
      expect(a.onFire).toBe(false);
      expect(a.owner).toBe('red');
    }
  });

  it('leaving the pen resets the clock', () => {
    const { w, herd } = campingRed();
    run(w, {}, SPOOK.after - 0.5);
    w.saucers.red.x = 640;
    stepWorld(w, {}, STEP);
    w.saucers.red.x = 90;
    run(w, {}, SPOOK.after - 0.5);
    expect(herd.every((a) => a.state === 'penned')).toBe(true);
  });
});
