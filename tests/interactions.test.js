// Mechanics meeting each other: cases that the per-feature tests don't cover.

import { describe, it, expect, afterEach } from 'vitest';
import { STEP, ARENA, WOLF, POWERUP, GOLDEN } from '../src/config.js';
import { createWorld, stepWorld, spawnWolf, spawnDrop } from '../src/logic/world.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { grantPower } from '../src/logic/powerup.js';
import { clampToPen } from '../src/logic/animal.js';
import { scores } from '../src/logic/scoring.js';
import { LOW, SHOOT, run, stepUntil, hover } from './helpers.js';

/** Drop a power-up and wait for it to land. */
function landedDrop(w, power) {
  spawnDrop(w, power);
  const drop = w.drops.at(-1);
  for (let t = 0; t < 10 && drop.state !== 'field'; t += STEP) stepWorld(w, {}, STEP);
  return drop;
}

const lambs = (w) => w.animals.filter((a) => a.kind === 'lamb');

/** A world with `n` lambs and one cow penned for blue, saucers parked high. */
function bluePen(n) {
  const w = createWorld(1);
  hover(w.saucers.red, 400, 100);
  hover(w.saucers.blue, 900, 100);
  const herd = [...lambs(w).slice(0, n), w.animals.find((a) => a.kind === 'cow')];
  herd.forEach((a, i) => Object.assign(a, { state: 'penned', pen: 'blue', owner: 'blue', vx: 0, x: clampToPen(1130 + i * 35, a.kind, 'blue') }));
  return { w, herd };
}

describe('the wolf and the animal swaps', () => {
  it('lambs → cows takes the lambs from under a wolf in a pen; it gets bored and leaves', () => {
    const { w } = bluePen(3);
    for (const a of w.animals) if (a.state === 'field') a.state = 'gone';
    const drop = landedDrop(w, 'cowRain');
    spawnWolf(w);
    const wolf = w.wolves[0];
    Object.assign(wolf, { state: 'penned', pen: 'blue', x: 1150, y: ARENA.groundY, eating: 1 });
    hover(w.saucers.red, drop.x);
    expect(stepUntil(w, {}, 3, (e) => e.type === 'animalRain')).toMatchObject({ from: 'lamb', penned: 3 });
    // No lambs left for it: the cows coming down are safe.
    run(w, {}, WOLF.eatTime + WOLF.boredAfter + 3);
    expect(wolf.state).toBe('gone');
    expect(w.animals.filter((a) => a.kind === 'cow' && a.pen === 'blue' && a.state === 'penned')).toHaveLength(4);
  });

  it('cows → lambs feeds a wolf in the field: the new lambs land and get chased', () => {
    const w = createWorld(1);
    hover(w.saucers.red, 400, 100);
    hover(w.saucers.blue, 900, 100);
    for (const a of lambs(w)) a.state = 'gone';
    const drop = landedDrop(w, 'lambRain');
    spawnWolf(w);
    Object.assign(w.wolves[0], { state: 'field', y: ARENA.groundY, x: 640 });
    hover(w.saucers.red, drop.x);
    expect(stepUntil(w, {}, 3, (e) => e.type === 'animalRain')).toMatchObject({ from: 'cow', to: 'lamb' });
    hover(w.saucers.red, 400, 100);
    // They take longer to come down than it waits with nothing to eat, but it waits for them.
    expect(stepUntil(w, {}, 20, (e) => e.type === 'wolfEat' || e.type === 'wolfLeaves')).toMatchObject({ type: 'wolfEat' });
  });
});

describe('the time bomb and the others', () => {
  it('a ram knocks a carried time bomb loose; it keeps counting and still goes off', () => {
    const w = createWorld(1);
    for (const a of w.animals) a.state = 'gone';
    hover(w.saucers.blue, 900, 100);
    hover(w.saucers.red, 700, LOW);
    grantPower(w.powers, 'red', 'timeBomb');
    stepWorld(w, SHOOT, STEP);
    const bomb = w.timeBombs[0];
    // Blue picks it up and carries it at mid height.
    stepUntil(w, {}, 2, (e) => e.type === 'timeBombLand');
    hover(w.saucers.red, 300, 100);
    hover(w.saucers.blue, bomb.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    expect(w.hooks.blue.carrying).toBe(bomb);
    hover(w.saucers.blue, 900, 300);
    hover(w.saucers.red, 60, 300);
    expect(stepUntil(w, { red: { x: 1, y: 0 } }, 4, (e) => e.type === 'ram')).toMatchObject({ victim: 'blue' });
    expect(w.hooks.blue.carrying).toBe(null);
    expect(bomb.state).toBe('falling');
    const blast = stepUntil(w, {}, POWERUP.timeBombFuse, (e) => e.type === 'bombBlast' || e.type === 'timeBombHeld');
    expect(blast).toMatchObject({ type: 'bombBlast', timed: true });
  });

  it('a time bomb blasting a pen with the wolf in it leaves the wolf there', () => {
    const { w } = bluePen(2);
    spawnWolf(w);
    const wolf = w.wolves[0];
    Object.assign(wolf, { state: 'penned', pen: 'blue', x: 1200, y: ARENA.groundY });
    wolf.eating = 100; // busy: don't let it eat the lambs during the test
    hover(w.saucers.red, 1190, 300);
    grantPower(w.powers, 'red', 'timeBomb');
    stepWorld(w, SHOOT, STEP);
    const blast = stepUntil(w, {}, POWERUP.timeBombFuse + 1, (e) => e.type === 'bombBlast');
    expect(blast).toMatchObject({ pen: 'blue' });
    expect(wolf.state).toBe('penned');
  });
});

describe('drops that come together', () => {
  const saved = { power: POWERUP.chance, golden: GOLDEN.chance };
  afterEach(() => {
    POWERUP.chance = saved.power;
    GOLDEN.chance = saved.golden;
  });

  it('a supply drop and a field restock in the same empty spell both arrive', () => {
    POWERUP.chance = 0;
    GOLDEN.chance = 0;
    const r = createRound(5);
    r.crates = { red: true, blue: true };
    r.wolfAt = null;
    while (r.phase !== 'play') stepRound(r, {}, STEP);
    const w = r.world;
    hover(w.saucers.red, 640, 100);
    hover(w.saucers.blue, 700, 100);
    w.animals.forEach((a, i) => Object.assign(a, { state: 'penned', pen: i % 2 ? 'red' : 'blue', owner: i % 2 ? 'red' : 'blue' }));
    w.weapons.red.ammo = 0;
    const seen = new Set();
    for (let t = 0; t < 12; t += STEP) {
      stepRound(r, {}, STEP);
      for (const e of r.events) seen.add(e.type);
    }
    expect(seen.has('restock')).toBe(true);
    expect(seen.has('crateIncoming') || seen.has('dropIncoming')).toBe(true);
  });

  it('scores stay finite and the round finishes with everything going on at once', () => {
    const r = createRound(9, 60);
    while (r.phase !== 'play') stepRound(r, {}, STEP);
    const w = r.world;
    spawnWolf(w);
    for (const p of ['cowRain', 'lambRain', 'timeBomb', 'bomb', 'shield']) spawnDrop(w, p);
    grantPower(w.powers, 'red', 'timeBomb');
    let t = 0;
    while (r.phase !== 'over' && t < 70) {
      const k = Math.floor(t * 2) % 4;
      stepRound(r, { red: { x: [1, 0, -1, 0][k], y: [0, 1, 0, -1][k], shoot: k === 0 }, blue: { x: -1, y: 1, shoot: k === 2 } }, STEP);
      t += STEP;
    }
    expect(r.phase).toBe('over');
    const p = scores(w.animals);
    expect(Number.isFinite(p.red) && Number.isFinite(p.blue)).toBe(true);
  });
});
