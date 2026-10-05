// The parachute power-up, and green men giving up when nobody picks them up.

import { describe, it, expect } from 'vitest';
import { STEP, ARENA, SAUCER, POWERUP, SPLAT } from '../src/config.js';
import { createWorld, stepWorld, spawnDrop, spawnCrate } from '../src/logic/world.js';
import { grantPower } from '../src/logic/powerup.js';
import { SHOOT, run, stepUntil, hover } from './helpers.js';

const outcome = (e) => e.type === 'land' || e.type === 'splat';

/** Red carries a lamb; blue is parked out of the way. */
function carrying(power = true) {
  const w = createWorld(2);
  const lamb = w.animals.find((a) => a.kind === 'lamb' && a.state === 'field');
  hover(w.saucers.blue, 1100, 60);
  hover(w.saucers.red, lamb.x);
  stepUntil(w, {}, 3, (e) => e.type === 'pickup' && e.side === 'red');
  expect(w.hooks.red.carrying).toBe(lamb);
  if (power) grantPower(w.powers, 'red', 'parachute');
  return { w, lamb };
}

describe('the parachute power-up', () => {
  it('a lamb let go of from up high opens a parachute and lands safely, slowly', () => {
    const { w, lamb } = carrying();
    hover(w.saucers.red, 640, 150);
    stepWorld(w, SHOOT, STEP);
    // Already coming down from high enough: it opens as it is let go.
    expect(w.events.find((e) => e.type === 'chuteOpen')).toMatchObject({ kind: 'lamb' });
    let t = 0;
    let end = null;
    for (; t < 10 && !end; t += STEP) {
      stepWorld(w, {}, STEP);
      end = w.events.find(outcome);
    }
    expect(end).toMatchObject({ type: 'land', kind: 'lamb' });
    expect(lamb.state).toBe('field');
    expect(lamb.chute).toBe(false);
    const freeFall = Math.sqrt((2 * (ARENA.groundY - lamb.fallFrom)) / 1400);
    expect(t).toBeGreaterThan(freeFall * 2);
  });

  it('without it, the same drop splats', () => {
    const { w } = carrying(false);
    hover(w.saucers.red, 640, 150);
    stepWorld(w, SHOOT, STEP);
    expect(stepUntil(w, {}, 3, outcome)).toMatchObject({ type: 'splat' });
  });

  it('a drop low enough to be safe gets no parachute', () => {
    const { w } = carrying();
    hover(w.saucers.red, 640, ARENA.flightBottom);
    stepWorld(w, SHOOT, STEP);
    const events = [];
    for (let t = 0; t < 2; t += STEP) {
      stepWorld(w, {}, STEP);
      events.push(...w.events);
    }
    expect(events.some((e) => e.type === 'chuteOpen')).toBe(false);
    expect(events.find(outcome)).toMatchObject({ type: 'land' });
  });

  it('thrown upward from a safe height, it opens at the top of the arc if the fall would splat', () => {
    const { w, lamb } = carrying();
    Object.assign(w.saucers.red, { x: 640, y: 400, vx: 0, vy: -SAUCER.maxSpeed });
    expect(ARENA.groundY - (400 + 60)).toBeLessThan(SPLAT.height);
    stepWorld(w, SHOOT, STEP);
    hover(w.saucers.red, 640, 100);
    const open = stepUntil(w, {}, 1, (e) => e.type === 'chuteOpen');
    expect(open).toBeTruthy();
    expect(lamb.vy).toBeGreaterThanOrEqual(0);
    expect(stepUntil(w, {}, 6, outcome)).toMatchObject({ type: 'land' });
  });

  it('also saves an animal knocked loose by a shot', () => {
    const { w } = carrying();
    hover(w.saucers.red, 640, 150);
    hover(w.saucers.blue, 900, 150);
    stepUntil(w, { blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'knockLoose');
    hover(w.saucers.blue, 1100, 60);
    expect(stepUntil(w, {}, 8, outcome)).toMatchObject({ type: 'land' });
  });

  it('only for the player who has it', () => {
    const { w } = carrying(false);
    grantPower(w.powers, 'blue', 'parachute');
    hover(w.saucers.red, 640, 150);
    stepWorld(w, SHOOT, STEP);
    expect(stepUntil(w, {}, 3, outcome)).toMatchObject({ type: 'splat' });
  });

  it('ends with the power-up', () => {
    const { w } = carrying();
    hover(w.saucers.red, 640, 150);
    run(w, {}, POWERUP.duration + 0.1);
    expect(w.powers.red).toBe(null);
    stepWorld(w, SHOOT, STEP);
    expect(stepUntil(w, {}, 3, outcome)).toMatchObject({ type: 'splat' });
  });
});

describe('a green man nobody picks up', () => {
  /** A drop standing in an otherwise empty field, saucers out of reach. */
  function landed(make) {
    const w = createWorld(3);
    for (const a of w.animals) a.state = 'gone';
    hover(w.saucers.red, 200, 60);
    hover(w.saucers.blue, 1100, 60);
    make(w);
    const d = w.drops.at(-1);
    let t = 0;
    for (; t < 10 && d.state !== 'field'; t += STEP) stepWorld(w, {}, STEP);
    return { w, d, fell: t };
  }

  it('gives up after a while: "Oh, no!", then he explodes and the power-up is gone for good', () => {
    const { w, d } = landed((w) => spawnDrop(w, 'laser'));
    run(w, {}, POWERUP.dropLife - 0.2);
    expect(d.panic).toBe(null);
    const panic = stepUntil(w, {}, 0.5, (e) => e.type === 'greenmanPanic');
    expect(panic).toMatchObject({ power: 'laser' });
    expect(d.vx).toBe(0);
    const gone = stepUntil(w, {}, POWERUP.panicTime + 0.1, (e) => e.type === 'greenmanGone');
    expect(gone).toMatchObject({ power: 'laser' });
    expect(d.state).toBe('gone');
    expect(w.events.some((e) => e.type === 'explosion')).toBe(true);
    // Not replaced.
    const events = [];
    for (let t = 0; t < 10; t += STEP) {
      stepWorld(w, {}, STEP);
      events.push(...w.events);
    }
    expect(events.some((e) => e.type === 'dropIncoming')).toBe(false);
  });

  it('hooked while he panics, he is saved and the power-up is granted', () => {
    const { w, d } = landed((w) => spawnDrop(w, 'shield'));
    stepUntil(w, {}, POWERUP.dropLife + 0.5, (e) => e.type === 'greenmanPanic');
    hover(w.saucers.red, d.x);
    expect(stepUntil(w, {}, 3, (e) => e.type === 'powerup' || e.type === 'greenmanGone')).toMatchObject({ type: 'powerup', power: 'shield' });
    expect(w.powers.red?.type).toBe('shield');
  });

  it('the time only counts once he is on the ground', () => {
    const { d, fell } = landed((w) => spawnDrop(w, 'speed'));
    expect(fell).toBeGreaterThan(2);
    expect(d.life).toBeCloseTo(POWERUP.dropLife, 5);
  });

  it('mystery packages and ammo crates wait as long as it takes', () => {
    for (const make of [(w) => spawnDrop(w, 'speed', true), (w) => spawnCrate(w, 'red')]) {
      const { w, d } = landed(make);
      const events = [];
      for (let t = 0; t < POWERUP.dropLife + POWERUP.panicTime + 5; t += STEP) {
        stepWorld(w, {}, STEP);
        events.push(...w.events);
      }
      expect(events.some((e) => e.type === 'greenmanPanic' || e.type === 'greenmanGone')).toBe(false);
      expect(d.state).toBe('field');
    }
  });
});
