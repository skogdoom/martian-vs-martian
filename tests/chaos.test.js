// Splat height at the top of the hook's reach, the green man splatting and
// coming back, the animal swaps reaching beams, and the out-of-ammo boost.

import { describe, it, expect } from 'vitest';
import { STEP, ARENA, SAUCER, HOOK, ANIMALS, POWERUP, RAM } from '../src/config.js';
import { createWorld, stepWorld, spawnDrop, dropInPlay } from '../src/logic/world.js';
import { grantPower } from '../src/logic/powerup.js';
import { speed } from '../src/logic/saucer.js';
import { LOW, run, stepUntil, hover } from './helpers.js';

/** Highest saucer y that still hooks `kind` standing on the ground. */
const topOfReach = (kind) => ARENA.groundY - ANIMALS.size[kind].h - HOOK.reach - SAUCER.halfHeight;

/** Red hooks `a` from height `y`, lifts it nearly all the way, then flies off sideways: the pickup breaks. */
function breakLateLift(w, a, y) {
  hover(w.saucers.red, a.x, y);
  expect(stepUntil(w, {}, 1, (e) => e.type === 'hook')).toMatchObject({ side: 'red', kind: a.kind });
  run(w, {}, HOOK.liftTime[a.kind] * 0.95);
  w.saucers.red.x += HOOK.driftLimit + 20;
  expect(stepUntil(w, {}, STEP * 2, (e) => e.type === 'interrupt')).toBeTruthy();
  return stepUntil(w, {}, 3, (e) => e.type === 'splat' || e.type === 'land' || e.type === 'dropLanded');
}

function quietWorld() {
  const w = createWorld(4);
  hover(w.saucers.blue, 1000, 100);
  return w;
}

describe('the top of the hook reach', () => {
  it('a lamb whose pickup breaks there splats', () => {
    const w = quietWorld();
    const lamb = w.animals.find((a) => a.kind === 'lamb' && a.state === 'field');
    expect(breakLateLift(w, lamb, topOfReach('lamb') + 1)).toMatchObject({ type: 'splat', kind: 'lamb' });
  });

  it('broken off low down, it lands safely', () => {
    const w = quietWorld();
    const lamb = w.animals.find((a) => a.kind === 'lamb' && a.state === 'field');
    expect(breakLateLift(w, lamb, LOW)).toMatchObject({ type: 'land', kind: 'lamb' });
  });
});

describe('the green man', () => {
  function landedMan(w, power = 'shield') {
    spawnDrop(w, power);
    const man = w.drops.at(-1);
    for (let t = 0; t < 10 && man.state !== 'field'; t += STEP) stepWorld(w, {}, STEP);
    man.wanderTimer = 99;
    man.vx = 0;
    for (const a of w.animals) a.state = 'gone'; // nothing else to hook
    return man;
  }

  it('dropped from too high, splats in green, and another one brings the same power-up', () => {
    const w = quietWorld();
    const man = landedMan(w);
    expect(breakLateLift(w, man, topOfReach('greenman') + 1)).toMatchObject({ type: 'splat', kind: 'greenman' });
    expect(man.state).toBe('gone');
    hover(w.saucers.red, 640, 100);
    expect(dropInPlay(w)).toBe(true); // no supply drop meanwhile
    run(w, {}, POWERUP.greenmanRespawn - 0.2);
    expect(w.drops.filter((d) => d.state !== 'gone')).toHaveLength(0);
    const again = stepUntil(w, {}, 0.5, (e) => e.type === 'dropIncoming');
    expect(again).toMatchObject({ power: 'shield', mystery: false });
    expect(w.drops.at(-1).state).toBe('descending');
  });

  it('dropped from low down, lands safely', () => {
    const w = quietWorld();
    const man = landedMan(w);
    expect(breakLateLift(w, man, LOW)).toMatchObject({ type: 'dropLanded' });
    expect(man.state).toBe('field');
  });
});

describe('the animal swaps and the beams', () => {
  it('lambs → cows bursts lambs being lifted or carried; the other kind is left alone', () => {
    const w = createWorld(1);
    const lambs = w.animals.filter((a) => a.kind === 'lamb' && a.state === 'field');
    const cow = w.animals.find((a) => a.kind === 'cow' && a.state === 'field');
    // Blue carries a lamb.
    hover(w.saucers.blue, lambs[0].x);
    hover(w.saucers.red, 640, 100);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup' && e.side === 'blue');
    const carried = w.hooks.blue.carrying;
    hover(w.saucers.blue, carried.x, 200);
    // The drop lands; red starts lifting it while blue starts on another lamb.
    spawnDrop(w, 'cowRain');
    const drop = w.drops.at(-1);
    for (let t = 0; t < 10 && drop.state !== 'field'; t += STEP) stepWorld(w, {}, STEP);
    grantPower(w.powers, 'blue', 'twin');
    const lifted = lambs.find((a) => a !== carried && a.state === 'field' && Math.abs(a.x - drop.x) > 100);
    hover(w.saucers.red, drop.x);
    hover(w.saucers.blue, lifted.x);
    const rain = stepUntil(w, {}, 3, (e) => e.type === 'animalRain');
    expect(rain).toMatchObject({ from: 'lamb', to: 'cow' });
    expect(carried.state).toBe('gone');
    expect(lifted.state).toBe('gone');
    expect(w.hooks.blue).toMatchObject({ carrying: null, second: null, target: null });
    expect(w.animals.filter((a) => a.kind === 'lamb' && a.state !== 'gone')).toHaveLength(0);
    // Their replacements come down in the field.
    const cows = w.animals.filter((a) => a.kind === 'cow' && a.state === 'descending');
    expect(cows.length).toBe(rain.count);
    expect(cow.state).not.toBe('gone');
  });
});

describe('out of ammo', () => {
  /** Seconds until red, from a standstill and flying right, is going ram speed; and its top speed. */
  function sprint(setup) {
    const w = createWorld(1);
    hover(w.saucers.red, 100, 200);
    hover(w.saucers.blue, 1000, 50);
    setup(w);
    let t = 0;
    let at = null;
    let top = 0;
    for (; t < 3; t += STEP) {
      stepWorld(w, { red: { x: 1, y: 0 } }, STEP);
      w.saucers.red.x = Math.min(w.saucers.red.x, 600); // room to keep going
      top = Math.max(top, speed(w.saucers.red));
      if (at === null && speed(w.saucers.red) >= RAM.speed) at = t;
    }
    return { at, top };
  }

  it('flies a little faster, and reaches ram speed sooner', () => {
    const armed = sprint(() => {});
    const empty = sprint((w) => {
      w.weapons.red.ammo = 0;
      w.weapons.red.clip = 0;
    });
    expect(empty.top / armed.top).toBeCloseTo(SAUCER.outOfAmmoBoost, 2);
    expect(empty.at).toBeLessThan(armed.at - 0.1);
  });

  it('not with a power-up that shoots for free', () => {
    const armed = sprint(() => {});
    const triple = sprint((w) => {
      w.weapons.red.ammo = 0;
      grantPower(w.powers, 'red', 'triple');
    });
    expect(triple.top).toBeCloseTo(armed.top, 5);
  });
});
