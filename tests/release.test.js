import { describe, it, expect } from 'vitest';
import { STEP, ARENA, COMBAT, SPLAT } from '../src/config.js';
import { createWorld, stepWorld } from '../src/logic/world.js';
import { grantPower } from '../src/logic/powerup.js';
import { scores, penCounts } from '../src/logic/scoring.js';
import { LOW, SHOOT, run, stepUntil } from './helpers.js';

const PEN_X = (ARENA.pens.red.left + ARENA.pens.red.right) / 2;
function place(s, x, y) {
  Object.assign(s, { x, y, vx: 0, vy: 0 });
}

/** Red has lifted a cow and holds it at (x, y). */
function carrying(x, y, kind = 'cow') {
  const w = createWorld(1);
  place(w.saucers.blue, 1000, 100);
  const a = w.animals.find((b) => b.kind === kind);
  place(w.saucers.red, a.x, LOW);
  stepUntil(w, {}, 3, (e) => e.type === 'pickup');
  place(w.saucers.red, x, y);
  stepWorld(w, {}, STEP); // let it swing into place under the saucer
  return { w, a, red: w.saucers.red };
}

describe('dropping a carried animal by hand', () => {
  it('uses the shoot key instead of firing', () => {
    const { w, a } = carrying(640, LOW);
    stepWorld(w, SHOOT, STEP);
    expect(w.events.find((e) => e.type === 'release')).toMatchObject({ side: 'red', kind: 'cow' });
    expect(w.projectiles).toHaveLength(0);
    expect(w.weapons.red.ammo).toBe(COMBAT.ammoPerRound);
    expect(w.hooks.red.carrying).toBe(null);
    expect(a.state).toBe('falling');
  });

  it('low over the field, it lands safely', () => {
    const { w, a } = carrying(640, LOW);
    stepWorld(w, SHOOT, STEP);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land')).toMatchObject({ pen: null });
    expect(a.state).toBe('field');
  });

  it('low over your own pen, it is a delivery', () => {
    // High enough not to be released automatically on the way in, low enough to be safe.
    const { w, a, red } = carrying(640, LOW);
    red.x = PEN_X;
    stepWorld(w, {}, STEP); // released automatically: low enough
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land')).toMatchObject({ pen: 'red', delivered: true, value: 2 });
    expect(a.pen).toBe('red');
  });

  it('from too high, it bursts and scores nothing', () => {
    const { w, a, red } = carrying(PEN_X, 150);
    expect(w.hooks.red.carrying).toBe(a); // too high to be let go automatically
    stepWorld(w, SHOOT, STEP);
    const splat = stepUntil(w, {}, 2, (e) => e.type === 'splat' || e.type === 'land');
    expect(splat).toMatchObject({ type: 'splat', kind: 'cow' });
    expect(a.state).toBe('gone');
    expect(scores(w.animals).red).toBe(0);
    expect(penCounts(w.animals, 'red').cows).toBe(0);
    // Gone for good: it can't be hooked again.
    place(red, a.x, LOW);
    run(w, {}, 1);
    expect(w.hooks.red.target).toBe(null);
  });

  it('with the twin beam, the lower animal goes first', () => {
    const w = createWorld(1);
    place(w.saucers.blue, 1000, 100);
    const [a, b] = w.animals.filter((x) => x.kind === 'lamb');
    grantPower(w.powers, 'red', 'twin');
    place(w.saucers.red, a.x, LOW);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    place(w.saucers.red, b.x, LOW);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    stepWorld(w, SHOOT, STEP);
    expect(w.hooks.red.carrying).toBe(a);
    expect(w.hooks.red.second).toBe(null);
    expect(b.state).toBe('falling');
  });
});

describe('automatic release over your own pen', () => {
  it('waits until the saucer is low enough', () => {
    const { w, a, red } = carrying(PEN_X, 150);
    run(w, {}, 0.5);
    expect(w.hooks.red.carrying).toBe(a);
    // Come down until the fall is safe.
    const e = stepUntil(w, { red: { x: 0, y: 1, shoot: false } }, 3, (e) => e.type === 'deliver');
    expect(e).toBeTruthy();
    expect(ARENA.groundY - a.y).toBeLessThanOrEqual(SPLAT.height);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land')).toMatchObject({ pen: 'red', delivered: true });
    expect(red.y).toBeGreaterThan(300);
  });
});
