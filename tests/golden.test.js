import { describe, it, expect, afterEach } from 'vitest';
import { STEP, ARENA, GOLDEN, ROUND, POWERUP } from '../src/config.js';
import { createWorld, stepWorld, spawnGolden } from '../src/logic/world.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { shouldDropGolden } from '../src/logic/golden.js';
import { canHook } from '../src/logic/hook.js';
import { clampToPen } from '../src/logic/animal.js';
import { scores } from '../src/logic/scoring.js';

const LOW = ARENA.flightBottom - 10;
const saved = { chance: GOLDEN.chance, powerChance: POWERUP.chance };
afterEach(() => {
  GOLDEN.chance = saved.chance;
  POWERUP.chance = saved.powerChance;
});

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

/** Put `n` of the herd's cows in `side`'s pen, owned by `side`. */
function pen(w, side, cows) {
  const herd = w.animals.filter((a) => a.kind === 'cow' && !a.golden).slice(0, cows);
  herd.forEach((a, i) => Object.assign(a, { state: 'penned', pen: side, owner: side, x: clampToPen((ARENA.pens[side].left + ARENA.pens[side].right) / 2 + i * 10, 'cow', side) }));
}

/** A world where blue leads 6-0 and a golden animal has landed in the field. */
function withGolden() {
  const w = createWorld(5);
  hover(w.saucers.red, 300, 100);
  hover(w.saucers.blue, 1000, 100);
  pen(w, 'blue', 3);
  spawnGolden(w, 'red');
  const g = w.animals.at(-1);
  expect(canHook({ ...w.saucers.red, x: g.x, y: LOW }, g)).toBe(false); // not while descending
  stepUntil(w, {}, 10, (e) => e.type === 'dropLanded');
  return { w, g };
}

/** `side` lifts `g` and flies it home. Returns the land event. */
function deliver(w, side, g) {
  const s = w.saucers[side];
  hover(s, g.x);
  expect(stepUntil(w, {}, 3, (e) => e.type === 'pickup')).toBeTruthy();
  s.x = side === 'red' ? 90 : 1190;
  const land = stepUntil(w, {}, 2, (e) => e.type === 'land');
  hover(s, 640, 100);
  return land;
}

describe('golden animal drop', () => {
  it('only when the lead is big enough, and then by chance', () => {
    GOLDEN.chance = 1;
    expect(shouldDropGolden({ red: 0, blue: GOLDEN.minLead }, Math.random)).toBe(true);
    expect(shouldDropGolden({ red: 5, blue: 5 - GOLDEN.minLead + 0.5 }, Math.random)).toBe(false);
    GOLDEN.chance = 0;
    expect(shouldDropGolden({ red: 0, blue: 9 }, Math.random)).toBe(false);
  });

  it('drops at the check point for the trailing player', () => {
    GOLDEN.chance = 1;
    POWERUP.chance = 0;
    const r = createRound(2);
    let incoming = null;
    let t = 0;
    while (r.phase !== 'over' && !incoming) {
      stepRound(r, {}, STEP);
      if (r.phase !== 'play') continue;
      t += STEP;
      if (t < 1) pen(r.world, 'blue', 2); // blue leads 4-0 all along
      incoming = r.events.find((e) => e.type === 'goldenIncoming');
    }
    expect(incoming.side).toBe('red');
    expect(t).toBeCloseTo(ROUND.length * GOLDEN.checkAt, 1);
    expect(r.world.animals.at(-1).golden).toBe(true);
  });

  it('does not drop in a close round', () => {
    GOLDEN.chance = 1;
    POWERUP.chance = 0;
    const r = createRound(2);
    while (r.phase !== 'over') stepRound(r, {}, STEP);
    expect(r.world.animals.some((a) => a.golden)).toBe(false);
  });
});

describe('golden animal value', () => {
  it('evens the score when the trailing player delivers it', () => {
    const { w, g } = withGolden();
    expect(scores(w.animals)).toEqual({ red: 0, blue: 6 });
    const land = deliver(w, 'red', g);
    expect(land).toMatchObject({ pen: 'red', delivered: true, golden: true, value: 6 });
    expect(scores(w.animals)).toEqual({ red: 6, blue: 6 });
  });

  it('is worth at least its normal value', () => {
    const { w, g } = withGolden();
    // Shrink blue's lead to 1: blue keeps one cow (2), red gets a lamb (1).
    const blueCows = w.animals.filter((a) => a.pen === 'blue');
    blueCows.slice(1).forEach((a) => Object.assign(a, { state: 'field', pen: null, owner: null, x: 640 }));
    const lamb = w.animals.find((a) => a.kind === 'lamb' && !a.golden);
    Object.assign(lamb, { state: 'penned', pen: 'red', owner: 'red', x: 60 });
    expect(scores(w.animals)).toEqual({ red: 1, blue: 2 });
    const full = { cow: 2, lamb: 1 }[g.kind];
    expect(deliver(w, 'red', g).value).toBe(Math.max(full, 1));
  });

  it('is just a cow or lamb when the leader delivers it', () => {
    const { w, g } = withGolden();
    const land = deliver(w, 'blue', g);
    expect(land).toMatchObject({ pen: 'blue', golden: false, value: { cow: 2, lamb: 1 }[g.kind] });
    expect(g.golden).toBe(false);
  });

  it('stays golden when a pickup is interrupted', () => {
    const { w, g } = withGolden();
    const red = w.saucers.red;
    hover(red, g.x);
    stepUntil(w, {}, 0.3, () => false);
    red.x += 40;
    stepUntil(w, {}, 2, (e) => e.type === 'land');
    expect(g.golden).toBe(true);
    expect(g.state).toBe('field');
  });

  it('is ordinary again once lifted out of the pen it paid out in', () => {
    const { w, g } = withGolden();
    deliver(w, 'red', g);
    const land = deliver(w, 'blue', g); // blue steals it back
    expect(g.golden).toBe(false);
    expect(land).toMatchObject({ pen: 'blue', stolen: true, value: { cow: 1, lamb: 0.5 }[g.kind] });
  });
});
