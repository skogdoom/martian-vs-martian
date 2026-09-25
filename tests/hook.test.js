import { describe, it, expect } from 'vitest';
import { STEP, ARENA, HOOK } from '../src/config.js';
import { createWorld, stepWorld } from '../src/logic/world.js';
import { canHook } from '../src/logic/hook.js';
import { clampToPen } from '../src/logic/animal.js';
import { scores } from '../src/logic/scoring.js';

const LOW = ARENA.flightBottom - 10;

/** Step until `pred(events)` is true or `seconds` run out. Returns the matching event. */
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

/** A world with both saucers parked out of the way and one animal picked out. */
function setup(kind = 'lamb') {
  const w = createWorld(1);
  const a = w.animals.find((x) => x.kind === kind);
  w.saucers.red.y = 100;
  w.saucers.blue.y = 100;
  return { w, a };
}

function hover(s, a, y = LOW) {
  s.x = a.x;
  s.y = y;
  s.vx = s.vy = 0;
}

function putInPen(a, side, owner = side) {
  a.x = clampToPen((ARENA.pens[side].left + ARENA.pens[side].right) / 2, a.kind, side);
  a.state = 'penned';
  a.pen = side;
  a.owner = owner;
}

describe('hook pickup', () => {
  it('lowers only when the saucer is low, still and above the animal', () => {
    const { w, a } = setup();
    const red = w.saucers.red;
    hover(red, a, 100);
    expect(canHook(red, a)).toBe(false); // too high
    hover(red, a);
    expect(canHook(red, a)).toBe(true);
    red.x += HOOK.grabRadius + 5;
    expect(canHook(red, a)).toBe(false); // not above it

    hover(red, a);
    red.vx = HOOK.stillSpeed * 2;
    stepWorld(w, {}, STEP);
    expect(w.hooks.red.target).toBe(null); // moving too fast
  });

  it('lifts a lamb in 1.0 s and a cow in 1.6 s', () => {
    for (const kind of ['lamb', 'cow']) {
      const { w, a } = setup(kind);
      hover(w.saucers.red, a);
      stepWorld(w, {}, STEP);
      expect(w.hooks.red.target).toBe(a);
      expect(a.state).toBe('lifting');
      let steps = 1;
      while (!w.hooks.red.carrying && steps < 1000) {
        stepWorld(w, {}, STEP);
        steps++;
      }
      expect(steps * STEP).toBeCloseTo(HOOK.liftTime[kind] + STEP, 1);
      expect(a.state).toBe('carried');
    }
  });

  it('is interrupted by drifting away from the animal', () => {
    const { w, a } = setup();
    const red = w.saucers.red;
    hover(red, a);
    run(w, {}, 0.3);
    expect(w.hooks.red.target).toBe(a);
    red.x += HOOK.driftLimit + 1;
    const e = stepUntil(w, {}, STEP, (e) => e.type === 'interrupt');
    expect(e?.reason).toBe('drift');
    expect(w.hooks.red.target).toBe(null);
    expect(a.hookedBy).toBe(null);
    expect(a.y).toBeLessThan(ARENA.groundY);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land')).toBeTruthy();
    expect(a.state).toBe('field');
    expect(a.y).toBe(ARENA.groundY);
  });

  it('is interrupted by a shot', () => {
    const { w, a } = setup('cow');
    const { red, blue } = w.saucers;
    hover(red, a);
    blue.x = a.x + 250;
    blue.y = LOW;
    const e = stepUntil(w, { blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'interrupt');
    expect(e?.reason).toBe('shot');
    expect(w.hooks.red.target).toBe(null);
    expect(w.hooks.red.carrying).toBe(null);
    expect(a.state).toBe('falling');
  });

  it('keeps a fully lifted animal when shot or bumped', () => {
    const { w, a } = setup();
    const { red, blue } = w.saucers;
    hover(red, a);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'pickup')).toBeTruthy();
    blue.x = red.x + 250;
    blue.y = red.y;
    expect(stepUntil(w, { blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'hit')).toBeTruthy();
    blue.x = red.x + 20;
    stepWorld(w, {}, STEP);
    expect(w.hooks.red.carrying).toBe(a);
    expect(a.state).toBe('carried');
  });

  it('carries one animal at a time', () => {
    const { w, a } = setup();
    const red = w.saucers.red;
    hover(red, a);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    const other = w.animals.find((x) => x !== a);
    hover(red, other);
    stepWorld(w, {}, STEP);
    expect(w.hooks.red.target).toBe(null);
    expect(other.state).toBe('field');
  });
});

describe('delivery and stealing', () => {
  it('delivers a carried animal into its own pen and scores it', () => {
    const { w, a } = setup('cow');
    const red = w.saucers.red;
    hover(red, a);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    const flyLeft = { red: { x: -1, y: 0, shoot: false } };
    // Flying over the field, or the opponent's pen, does not release it.
    expect(stepUntil(w, flyLeft, 5, (e) => e.type === 'deliver')?.side).toBe('red');
    expect(red.x).toBeLessThanOrEqual(ARENA.pens.red.right);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land')?.pen).toBe('red');
    expect(a.state).toBe('penned');
    expect(a.owner).toBe('red');
    expect(scores(w.animals)).toEqual({ red: 2, blue: 0 });

    // Penned animals stay put.
    const x = a.x;
    run(w, {}, 3);
    expect(a.x).toBe(x);
  });

  it('does not release over the opponent pen', () => {
    const { w, a } = setup();
    const red = w.saucers.red;
    hover(red, a);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    red.x = (ARENA.pens.blue.left + ARENA.pens.blue.right) / 2;
    stepWorld(w, {}, STEP);
    expect(w.hooks.red.carrying).toBe(a);
  });

  it('cannot hook animals in its own pen', () => {
    const { w, a } = setup();
    putInPen(a, 'red');
    const red = w.saucers.red;
    hover(red, a);
    expect(canHook(red, a)).toBe(false);
    stepWorld(w, {}, STEP);
    expect(w.hooks.red.target).toBe(null);
  });

  it('steals from the opponent pen for half value', () => {
    const { w, a } = setup('cow');
    const lamb = w.animals.find((x) => x.kind === 'lamb');
    putInPen(a, 'blue');
    putInPen(lamb, 'blue');
    lamb.x = ARENA.pens.blue.right - 40;
    expect(scores(w.animals)).toEqual({ red: 0, blue: 3 });

    const red = w.saucers.red;
    hover(red, a);
    expect(canHook(red, a)).toBe(true);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    expect(a.pen).toBe(null);
    expect(scores(w.animals)).toEqual({ red: 0, blue: 1 });

    red.x = 90;
    stepUntil(w, {}, 2, (e) => e.type === 'land');
    expect(a.pen).toBe('red');
    expect(a.owner).toBe('blue');
    expect(scores(w.animals)).toEqual({ red: 1, blue: 1 });
  });

  it('an interrupted steal drops the animal back into the pen it came from', () => {
    const { w, a } = setup();
    putInPen(a, 'blue');
    const red = w.saucers.red;
    hover(red, a);
    run(w, {}, 0.2);
    expect(a.state).toBe('lifting');
    expect(scores(w.animals).blue).toBe(1); // still counts while lifting
    red.x += HOOK.driftLimit + 1;
    stepUntil(w, {}, 2, (e) => e.type === 'land');
    expect(a.state).toBe('penned');
    expect(a.pen).toBe('blue');
  });
});
