import { describe, it, expect } from 'vitest';
import { STEP, SAUCER, ARENA, WIDTH, BUMP } from '../src/config.js';
import { createSaucer, steerSaucer, moveSaucer, bumpSaucers, speed } from '../src/logic/saucer.js';

function fly(s, input, seconds) {
  for (let t = 0; t < seconds; t += STEP) {
    steerSaucer(s, input, STEP);
    moveSaucer(s, STEP);
  }
}

describe('saucer movement', () => {
  it('accelerates up to max speed and no further', () => {
    const s = createSaucer('red');
    s.x = 300;
    fly(s, { x: 1, y: 0 }, 0.5);
    expect(speed(s)).toBeGreaterThan(SAUCER.maxSpeed * 0.9);
    expect(speed(s)).toBeLessThanOrEqual(SAUCER.maxSpeed + 1e-6);
  });

  it('diagonal input is no faster than straight input', () => {
    const s = createSaucer('red');
    s.x = 300;
    fly(s, { x: 1, y: 1 }, 0.3);
    expect(speed(s)).toBeLessThanOrEqual(SAUCER.maxSpeed + 1e-6);
  });

  it('coasts to a stop under drag', () => {
    const s = createSaucer('red');
    s.x = 600;
    s.vx = SAUCER.maxSpeed;
    fly(s, { x: 0, y: 0 }, 2);
    expect(speed(s)).toBeLessThan(1);
  });

  it('does not cap knockback speed', () => {
    const s = createSaucer('red');
    s.x = 600;
    s.vx = 900;
    fly(s, { x: 1, y: 0 }, STEP);
    expect(s.vx).toBeGreaterThan(SAUCER.maxSpeed);
  });

  it('stays inside the flight band and walls', () => {
    const s = createSaucer('blue');
    fly(s, { x: 1, y: 1 }, 3);
    expect(s.x).toBe(WIDTH - SAUCER.radius);
    expect(s.y).toBe(ARENA.flightBottom);
    fly(s, { x: -1, y: -1 }, 6);
    expect(s.x).toBe(SAUCER.radius);
    expect(s.y).toBe(ARENA.flightTop + SAUCER.top);
  });
});

describe('bump', () => {
  it('pushes overlapping saucers apart with a small impulse', () => {
    const a = createSaucer('red');
    const b = createSaucer('blue');
    a.x = 600;
    b.x = 640;
    a.y = b.y = 200;
    expect(bumpSaucers(a, b)).toBe(true);
    expect(b.x - a.x).toBeCloseTo(SAUCER.radius * 2);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(Math.abs(a.vx)).toBeLessThan(SAUCER.maxSpeed);
  });

  it('counts saucers that stay close as one contact until they separate', () => {
    const a = createSaucer('red');
    const b = createSaucer('blue');
    a.y = b.y = 200;
    const touch = (gap) => {
      a.x = 600;
      b.x = 600 + gap;
      return bumpSaucers(a, b);
    };
    expect(touch(60)).toBe(true);
    expect(touch(SAUCER.radius * 2 + 2)).toBe(false); // barely apart
    expect(touch(60)).toBe(false); // same contact
    expect(touch(SAUCER.radius * 2 + BUMP.rearm + 1)).toBe(false); // properly apart
    expect(touch(60)).toBe(true); // a new bump
  });

  it('ignores saucers that are apart', () => {
    const a = createSaucer('red');
    const b = createSaucer('blue');
    expect(bumpSaucers(a, b)).toBe(false);
    expect(a.vx).toBe(0);
  });
});
