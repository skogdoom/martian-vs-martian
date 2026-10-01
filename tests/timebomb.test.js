import { describe, it, expect } from 'vitest';
import { STEP, ARENA, POWERUP, COMBAT } from '../src/config.js';
import { createWorld, stepWorld } from '../src/logic/world.js';
import { grantPower } from '../src/logic/powerup.js';
import { clampToPen } from '../src/logic/animal.js';
import { LOW, SHOOT, run, stepUntil, collect, hover } from './helpers.js';

const BLUE_PEN_X = (ARENA.pens.blue.left + ARENA.pens.blue.right) / 2;
const RED_PEN_X = (ARENA.pens.red.left + ARENA.pens.red.right) / 2;

/** Blue has three animals penned; red holds a time bomb over `x`. */
function setup(x = BLUE_PEN_X, y = 300) {
  const w = createWorld(1);
  const herd = w.animals.slice(0, 3);
  herd.forEach((a, i) => Object.assign(a, { state: 'penned', pen: 'blue', owner: 'blue', vx: 0, x: clampToPen(1120 + i * 40, a.kind, 'blue') }));
  hover(w.saucers.blue, 640, 100);
  hover(w.saucers.red, x, y);
  grantPower(w.powers, 'red', 'timeBomb');
  return { w, herd, red: w.saucers.red, blue: w.saucers.blue };
}

describe('time bomb', () => {
  it('is single use: the shoot key drops it, and it costs no ammo', () => {
    const { w } = setup();
    expect(w.powers.red.timeLeft).toBe(null);
    stepWorld(w, SHOOT, STEP);
    expect(w.events.find((e) => e.type === 'timeBombDrop')).toMatchObject({ side: 'red' });
    expect(w.powers.red).toBe(null);
    expect(w.weapons.red.ammo).toBe(COMBAT.ammoPerRound);
    expect(w.timeBombs).toHaveLength(1);
    expect(w.timeBombs[0].state).toBe('falling');
  });

  it('counts down, then blows animals out of the pen it lies in', () => {
    const { w, herd } = setup();
    stepWorld(w, SHOOT, STEP);
    const land = stepUntil(w, {}, 2, (e) => e.type === 'timeBombLand');
    expect(land).toMatchObject({ pen: 'blue', by: 'red' });
    expect(w.timeBombs[0].state).toBe('penned');
    const events = collect(w, {}, POWERUP.timeBombFuse, ['tick', 'bombBlast']);
    const ticks = events.filter((e) => e.type === 'tick').map((e) => e.n);
    expect(ticks.at(-1)).toBe(1);
    expect(ticks).toEqual([...ticks].sort((a, b) => b - a));
    const blast = events.find((e) => e.type === 'bombBlast');
    expect(blast).toMatchObject({ pen: 'blue', side: 'red', timed: true });
    expect(blast.count).toBeGreaterThan(0);
    expect(herd.filter((a) => a.state === 'falling')).toHaveLength(blast.count);
    expect(w.timeBombs[0].state).toBe('gone');
  });

  it('gives the pen owner time to lift it out and carry it off', () => {
    const { w, herd, blue } = setup();
    stepWorld(w, SHOOT, STEP);
    stepUntil(w, {}, 2, (e) => e.type === 'timeBombLand');
    const bomb = w.timeBombs[0];
    // Blue flies over from the middle of the field.
    const events = [];
    const toPen = { blue: { x: 1, y: 1 } };
    for (let t = 0; t < 3 && blue.x < bomb.x - 10; t += STEP) {
      stepWorld(w, toPen, STEP);
    }
    hover(blue, bomb.x);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'pickup')).toMatchObject({ side: 'blue', kind: 'timebomb' });
    expect(bomb.fuse).toBeGreaterThan(3);
    // Never let go of automatically, even over its own pen.
    run(w, {}, 0.3);
    expect(w.hooks.blue.carrying).toBe(bomb);
    // Off to red's pen and drop it there.
    hover(blue, RED_PEN_X, 300);
    stepWorld(w, { blue: { x: 0, y: 0, shoot: true } }, STEP);
    events.push(...collect(w, {}, bomb.fuse + 0.1, ['timeBombLand', 'bombBlast']));
    expect(events[0]).toMatchObject({ type: 'timeBombLand', pen: 'red', by: 'blue' });
    expect(events[1]).toMatchObject({ type: 'bombBlast', pen: 'red', side: 'blue' });
    expect(herd.every((a) => a.state === 'penned' && a.pen === 'blue')).toBe(true);
  });

  it('going off in a beam dazes that saucer and blasts no pen', () => {
    const { w, herd } = setup(700, LOW);
    for (const a of w.animals) if (!herd.includes(a)) a.state = 'gone'; // nothing else to lift
    stepWorld(w, SHOOT, STEP);
    const bomb = w.timeBombs[0];
    // Hovering low right over it, the beam grabs it as soon as it lands.
    expect(stepUntil(w, {}, 3, (e) => e.type === 'pickup')).toMatchObject({ side: 'red', kind: 'timebomb' });
    expect(w.hooks.red.carrying).toBe(bomb);
    hover(w.saucers.red, BLUE_PEN_X, LOW);
    const held = stepUntil(w, {}, POWERUP.timeBombFuse, (e) => e.type === 'timeBombHeld');
    expect(held).toMatchObject({ side: 'red' });
    expect(w.events.some((e) => e.type === 'bombBlast')).toBe(false);
    expect(w.saucers.red.stun).toBeCloseTo(POWERUP.timeBombDaze, 5);
    expect(w.hooks.red.carrying).toBe(null);
    expect(bomb.state).toBe('gone');
    expect(herd.every((a) => a.state === 'penned')).toBe(true);
  });

  it('in the field it just goes off', () => {
    const { w } = setup(640, LOW);
    stepWorld(w, SHOOT, STEP);
    const blast = stepUntil(w, {}, POWERUP.timeBombFuse + 0.5, (e) => e.type === 'bombBlast');
    expect(blast).toMatchObject({ pen: null, count: 0 });
  });
});
