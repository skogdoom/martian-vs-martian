import { describe, it, expect, afterEach } from 'vitest';
import { STEP, ARENA, WOLF, POWERUP, GOLDEN, ROUND } from '../src/config.js';
import { createWorld, stepWorld, spawnWolf } from '../src/logic/world.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { clampToPen } from '../src/logic/animal.js';
import { scores } from '../src/logic/scoring.js';

const LOW = ARENA.flightBottom - 10;
const SHOOT = { red: { x: 0, y: 0, shoot: true } };
const saved = { chance: WOLF.chance, power: POWERUP.chance, golden: GOLDEN.chance };
afterEach(() => {
  WOLF.chance = saved.chance;
  POWERUP.chance = saved.power;
  GOLDEN.chance = saved.golden;
});

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

/** A world with the wolf standing in the field at `x`, saucers parked high. */
function withWolf(x = 640) {
  const w = createWorld(2);
  hover(w.saucers.red, 300, 100);
  hover(w.saucers.blue, 980, 100);
  spawnWolf(w);
  const wolf = w.wolves[0];
  Object.assign(wolf, { state: 'field', x, y: ARENA.groundY });
  return { w, wolf };
}

const lambs = (w) => w.animals.filter((a) => a.kind === 'lamb');
const pen = (w, side, kind) => w.animals.filter((a) => a.kind === kind && a.pen === side && a.state === 'penned');

/** Put `n` lambs and one cow in `side`'s pen, delivered by `side`. */
function fillPen(w, side, n) {
  const herd = [...lambs(w).slice(0, n), w.animals.find((a) => a.kind === 'cow')];
  herd.forEach((a, i) => Object.assign(a, { state: 'penned', pen: side, owner: side, vx: 0, x: clampToPen((side === 'red' ? 30 : 1130) + i * 35, a.kind, side) }));
  return herd;
}

describe('the wolf in the field', () => {
  it('parachutes in, then hunts down every lamb in the field and leaves the cows', () => {
    const w = createWorld(2);
    hover(w.saucers.red, 300, 100);
    hover(w.saucers.blue, 980, 100);
    spawnWolf(w);
    expect(w.events.at(-1)).toMatchObject({ type: 'wolfIncoming' });
    expect(w.wolves[0].state).toBe('descending');
    const cows = w.animals.filter((a) => a.kind === 'cow');
    let eaten = 0;
    for (let t = 0; t < 60 && lambs(w).some((a) => a.state !== 'gone'); t += STEP) {
      stepWorld(w, {}, STEP);
      eaten += w.events.filter((e) => e.type === 'wolfEat').length;
    }
    expect(eaten).toBe(lambs(w).length);
    expect(lambs(w).every((a) => a.state === 'gone')).toBe(true);
    expect(cows.every((a) => a.state === 'field')).toBe(true);
  });

  it('lambs nearby run from it', () => {
    const { w } = withWolf();
    const lamb = lambs(w).find((a) => Math.abs(a.x - 640) < WOLF.scareRange);
    stepWorld(w, {}, STEP);
    expect(Math.sign(lamb.vx)).toBe(Math.sign(lamb.x - w.wolves[0].x));
    expect(Math.abs(lamb.vx)).toBe(WOLF.fleeSpeed);
  });

  it('does not touch lambs in pens, or in a beam', () => {
    const { w, wolf } = withWolf();
    const penned = fillPen(w, 'red', 2);
    const lamb = lambs(w).find((a) => a.state === 'field');
    hover(w.saucers.blue, lamb.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup' && e.side === 'blue');
    run(w, {}, 30);
    expect(penned.every((a) => a.state === 'penned')).toBe(true);
    expect(lamb.state).toBe('carried');
    expect(wolf.state).toBe('gone'); // got bored
  });

  it('gets bored when there is nothing to eat, and runs off', () => {
    const { w, wolf } = withWolf();
    lambs(w).forEach((a) => (a.state = 'gone'));
    run(w, {}, WOLF.boredAfter - 0.2);
    expect(wolf.state).toBe('field');
    const e = stepUntil(w, {}, 0.5, (e) => e.type === 'wolfLeaves');
    expect(e).toBeTruthy();
    expect(wolf.state).toBe('leaving');
    run(w, {}, 4);
    expect(wolf.state).toBe('gone');
    // Gone for good: it can't be hooked.
    hover(w.saucers.red, wolf.x);
    run(w, {}, 1);
    expect(w.hooks.red.target).toBe(null);
  });
});

describe('the wolf in a pen', () => {
  /** Red has the wolf on the beam. */
  function carryingWolf() {
    const { w, wolf } = withWolf();
    lambs(w).forEach((a) => Object.assign(a, { state: 'gone' })); // nothing to chase in the field
    hover(w.saucers.red, wolf.x);
    const hook = stepUntil(w, {}, 1, (e) => e.type === 'hook');
    expect(hook).toMatchObject({ side: 'red', kind: 'wolf' });
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    expect(w.hooks.red.carrying).toBe(wolf);
    return { w, wolf };
  }

  it('dropped in the opponent pen, eats the lambs there and the score goes down', () => {
    const { w, wolf } = carryingWolf();
    const blueLambs = fillPen(w, 'blue', 3).filter((a) => a.kind === 'lamb');
    for (const a of blueLambs) a.state = 'penned';
    const before = scores(w.animals).blue;
    hover(w.saucers.red, 1190, 300);
    stepWorld(w, SHOOT, STEP); // let go from high up: a wolf lands on its feet
    const land = stepUntil(w, {}, 2, (e) => e.type === 'wolfLand');
    expect(land).toMatchObject({ pen: 'blue', by: 'red' });
    expect(wolf.state).toBe('penned');
    run(w, {}, 3 * (WOLF.eatTime + 1.5));
    expect(blueLambs.every((a) => a.state === 'gone')).toBe(true);
    expect(scores(w.animals).blue).toBe(before - 3);
    expect(pen(w, 'blue', 'cow')).toHaveLength(1);
    // Then it gets bored and leaves, off the near edge.
    run(w, {}, WOLF.boredAfter + 2);
    expect(wolf.state).toBe('gone');
  });

  it('is never let go of automatically over your own pen', () => {
    const { w, wolf } = carryingWolf();
    hover(w.saucers.red, (ARENA.pens.red.left + ARENA.pens.red.right) / 2);
    run(w, {}, 1);
    expect(w.hooks.red.carrying).toBe(wolf);
  });

  it('can be lifted back out of your own pen', () => {
    const { w, wolf } = withWolf();
    fillPen(w, 'red', 3);
    Object.assign(wolf, { state: 'penned', pen: 'red', x: 150 });
    hover(w.saucers.red, 150);
    expect(stepUntil(w, {}, 1, (e) => e.type === 'hook')).toMatchObject({ side: 'red', kind: 'wolf' });
  });

  it('knocked loose, it lands safely wherever it falls', () => {
    const { w, wolf } = carryingWolf();
    hover(w.saucers.red, 640, 150);
    hover(w.saucers.blue, 900, 150);
    stepUntil(w, { blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'knockLoose');
    const land = stepUntil(w, {}, 2, (e) => e.type === 'wolfLand' || e.type === 'splat');
    expect(land).toMatchObject({ type: 'wolfLand', pen: null, by: null });
    expect(wolf.state).toBe('field');
  });
});

describe('when the wolf comes', () => {
  it('some rounds, at a random time in the window', () => {
    POWERUP.chance = 0;
    GOLDEN.chance = 0;
    WOLF.chance = 1;
    const r = createRound(3);
    let at = null;
    let t = 0;
    while (r.phase !== 'over') {
      stepRound(r, {}, STEP);
      if (r.phase !== 'play') continue;
      t += STEP;
      if (r.events.some((e) => e.type === 'wolfIncoming')) at = t;
    }
    expect(at).toBeGreaterThanOrEqual(ROUND.length * WOLF.window[0] - 0.1);
    expect(at).toBeLessThanOrEqual(ROUND.length * WOLF.window[1] + 0.1);
    expect(r.world.wolves).toHaveLength(1);
  });

  it('never when the chance is zero', () => {
    WOLF.chance = 0;
    const r = createRound(3);
    while (r.phase !== 'over') stepRound(r, {}, STEP);
    expect(r.world.wolves).toHaveLength(0);
  });
});
