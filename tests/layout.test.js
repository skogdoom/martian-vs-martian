import { describe, it, expect, afterEach } from 'vitest';
import { STEP, ARENA, SAUCER, WIDTH, HEIGHT } from '../src/config.js';
import { fitWindow, sceneShift, layout, MAX_EXTRA } from '../src/layout.js';
import { createWorld, stepWorld, spawnDrop } from '../src/logic/world.js';
import { createRocket, updateRocket } from '../src/logic/ordnance.js';
import { createSaucer, steerSaucer, moveSaucer } from '../src/logic/saucer.js';

const top = ARENA.flightTop;
afterEach(() => {
  ARENA.flightTop = top;
});

describe('fitting the window', () => {
  it('a 16:9 window shows exactly the design area', () => {
    const f = fitWindow(1920, 1080);
    expect(f.scale).toBe(1.5);
    expect(f.visible).toBe(HEIGHT);
    expect(layout.extra).toBe(0);
    expect(f).toMatchObject({ x: 0, y: 0 });
  });

  it('a taller window shows more height instead of bars', () => {
    const f = fitWindow(1440, 900); // 16:10
    expect(f.scale).toBeCloseTo(1.125);
    expect(f.visible).toBeCloseTo(800);
    expect(layout.extra).toBeCloseTo(80);
    expect(f.y).toBe(0); // the whole height is used
    expect(f.visible * f.scale).toBeCloseTo(900);
  });

  it('a 4:3 window gets 240 more px', () => {
    fitWindow(1024, 768);
    expect(layout.extra).toBeCloseTo(240);
  });

  it('caps the extra height; beyond that the rest is centred bars', () => {
    const f = fitWindow(600, 1200); // portrait
    expect(layout.extra).toBe(MAX_EXTRA);
    expect(f.visible).toBe(HEIGHT + MAX_EXTRA);
    expect(f.y).toBeGreaterThan(0);
    expect(f.y * 2 + f.visible * f.scale).toBeCloseTo(1200, 0);
  });

  it('a wider window still gets bars at the sides, with the full height used', () => {
    const f = fitWindow(2000, 720);
    expect(f.scale).toBe(1);
    expect(layout.extra).toBe(0);
    expect(f.x).toBe(360);
  });

  it('the arena sits at the bottom, menus in the middle', () => {
    fitWindow(1024, 768);
    expect(sceneShift('bottom')).toBeCloseTo(240);
    expect(sceneShift('center')).toBeCloseTo(120);
    expect(sceneShift(undefined)).toBeCloseTo(120);
  });
});

describe('the extra sky is playable', () => {
  it('saucers can fly up to the new top', () => {
    ARENA.flightTop = -200;
    const s = createSaucer('red');
    s.x = 600;
    s.y = 100;
    for (let t = 0; t < 4; t += STEP) {
      steerSaucer(s, { x: 0, y: -1 }, STEP);
      moveSaucer(s, STEP);
    }
    expect(s.y).toBe(-200 + SAUCER.top);
  });

  it('with the default top, nothing changes', () => {
    const s = createSaucer('red');
    s.x = 600;
    for (let t = 0; t < 4; t += STEP) {
      steerSaucer(s, { x: 0, y: -1 }, STEP);
      moveSaucer(s, STEP);
    }
    expect(s.y).toBe(SAUCER.top);
  });

  it('parachutes start just above the top of the screen', () => {
    ARENA.flightTop = -200;
    const w = createWorld(1);
    spawnDrop(w, 'speed');
    expect(w.drops[0].y).toBe(-220);
    ARENA.flightTop = 0;
    const w2 = createWorld(1);
    spawnDrop(w2, 'speed');
    expect(w2.drops[0].y).toBe(-20);
  });

  it('rockets only burn out when they leave the visible area', () => {
    ARENA.flightTop = -200;
    const shooter = { side: 'red', x: 600, y: -100, vx: 0, vy: 0 };
    const target = { x: 640, y: -150, vx: 0, vy: 0 };
    const r = createRocket(shooter, target);
    r.life = 10;
    r.y = -100;
    expect(updateRocket(r, { x: 5000, y: -100 }, STEP)).toBe(null); // above the old top, still on screen
  });

  it('the world still runs with extra sky', () => {
    ARENA.flightTop = -240;
    const w = createWorld(1);
    for (let t = 0; t < 3; t += STEP) stepWorld(w, { red: { x: 0, y: -1 } }, STEP);
    expect(w.saucers.red.y).toBeLessThan(0);
    expect(w.saucers.red.y).toBeGreaterThanOrEqual(-240 + SAUCER.top);
  });
});

describe('layout constants', () => {
  it('the width never changes', () => {
    expect(WIDTH).toBe(1280);
  });
});
