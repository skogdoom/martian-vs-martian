import { describe, it, expect, afterEach } from 'vitest';
import { STEP, ARENA, SAUCER, COMBAT, POWERUP, GOLDEN, SUPPLY } from '../src/config.js';
import { createWorld, stepWorld, spawnDrop } from '../src/logic/world.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { grantPower } from '../src/logic/powerup.js';
import { createGolden } from '../src/logic/golden.js';
import { scores } from '../src/logic/scoring.js';
import { SHOOT, run, stepUntil, hover } from './helpers.js';

const saved = { power: POWERUP.chance, golden: GOLDEN.chance };
afterEach(() => {
  POWERUP.chance = saved.power;
  GOLDEN.chance = saved.golden;
});

/** Press shoot `n` times, far enough apart for the fire cooldown. */
function shootTimes(w, n) {
  let fired = 0;
  for (let i = 0; i < n; i++) {
    stepWorld(w, SHOOT, STEP);
    fired += w.events.filter((e) => e.type === 'shot').length;
    run(w, {}, COMBAT.fireCooldown + 0.02);
  }
  return fired;
}

describe('infinite ammo', () => {
  it('fires without spending ammo or reloading', () => {
    const w = createWorld(1);
    hover(w.saucers.blue, 640, 100); // out of the line of fire
    grantPower(w.powers, 'red', 'unlimited');
    expect(shootTimes(w, 10)).toBe(10);
    expect(w.weapons.red.ammo).toBe(COMBAT.ammoPerRound);
    expect(w.weapons.red.reload).toBe(0);
  });

  it('works with an empty gun, and the free shots go with the power-up', () => {
    const w = createWorld(1);
    hover(w.saucers.blue, 640, 100);
    Object.assign(w.weapons.red, { clip: 0, ammo: 0 });
    grantPower(w.powers, 'red', 'unlimited');
    expect(shootTimes(w, 5)).toBe(5);
    run(w, {}, POWERUP.duration);
    expect(w.powers.red).toBe(null);
    expect(w.weapons.red.clip).toBe(0);
    expect(shootTimes(w, 1)).toBe(0);
  });
});

describe('shield', () => {
  /** Blue carries a cow at (900, 300), shielded; red is level with it. */
  function carrying() {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    const cow = w.animals.find((a) => a.kind === 'cow');
    hover(blue, cow.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    hover(blue, 900, 300);
    hover(red, 500, 300);
    grantPower(w.powers, 'blue', 'shield');
    return { w, cow, red, blue };
  }

  it('shots bounce off: no knockback, and the animal stays on', () => {
    const { w, cow, blue } = carrying();
    const hit = stepUntil(w, SHOOT, 1, (e) => e.type === 'hit');
    expect(hit).toMatchObject({ side: 'blue', shielded: true });
    expect(blue.vx).toBe(0);
    expect(w.hooks.blue.carrying).toBe(cow);
  });

  it('a pickup in progress is not broken by a hit', () => {
    const w = createWorld(1);
    const lamb = w.animals.find((a) => a.kind === 'lamb');
    hover(w.saucers.blue, lamb.x);
    grantPower(w.powers, 'blue', 'shield');
    stepWorld(w, {}, STEP);
    hover(w.saucers.red, lamb.x - 300, w.saucers.blue.y);
    stepUntil(w, SHOOT, 1, (e) => e.type === 'hit');
    expect(w.hooks.blue.target).toBe(lamb);
    expect(stepUntil(w, {}, 3, (e) => e.type === 'pickup')).toMatchObject({ side: 'blue' });
  });

  it('the laser does not push it', () => {
    const { w, cow, blue } = carrying();
    grantPower(w.powers, 'red', 'laser');
    run(w, { red: { x: 0, y: 0, fire: true } }, 0.5);
    expect(blue.x).toBeCloseTo(900, 0);
    expect(w.hooks.blue.carrying).toBe(cow);
  });

  it('a rocket does not stun it', () => {
    const { w, cow, blue } = carrying();
    grantPower(w.powers, 'red', 'rocket');
    stepWorld(w, SHOOT, STEP);
    const hit = stepUntil(w, {}, 3, (e) => e.type === 'hit');
    expect(hit).toMatchObject({ rocket: true, shielded: true });
    expect(blue.stun).toBe(0);
    expect(w.hooks.blue.carrying).toBe(cow);
  });

  it('a bump does not move it; the other saucer takes the whole bounce', () => {
    const { w, cow, red, blue } = carrying();
    hover(red, 900 - SAUCER.radius * 2 - 4, 300);
    red.vx = 250;
    const bump = stepUntil(w, {}, 0.5, (e) => e.type === 'bump');
    expect(bump).toBeTruthy();
    expect(blue.x).toBe(900);
    expect(blue.vx).toBe(0);
    expect(red.vx).toBeLessThan(0);
    expect(w.hooks.blue.carrying).toBe(cow);
  });
});

describe('laser against a shield that runs out', () => {
  it('keeps pushing without crashing when the shield ends mid-beam', () => {
    const w = createWorld(1);
    hover(w.saucers.red, 400, 300);
    hover(w.saucers.blue, 700, 300);
    grantPower(w.powers, 'red', 'laser');
    grantPower(w.powers, 'blue', 'shield');
    w.powers.blue.timeLeft = 0.2;
    run(w, { red: { x: 0, y: 0, fire: true } }, 0.5);
    expect(w.powers.blue).toBe(null);
    expect(w.saucers.blue.vx).toBeGreaterThan(0);
  });
});

describe('lambs to cows and cows to lambs', () => {
  function grab(power) {
    const w = createWorld(3);
    hover(w.saucers.blue, 1000, 100);
    const pennedLamb = w.animals.find((a) => a.kind === 'lamb');
    Object.assign(pennedLamb, { state: 'penned', pen: 'blue', owner: 'blue', x: 1180 });
    const gold = createGolden(() => 0.9); // a golden lamb
    Object.assign(gold, { state: 'field', y: ARENA.groundY });
    w.animals.push(gold);
    grantPower(w.powers, 'red', 'rocket'); // held: must survive the grab
    spawnDrop(w, power);
    stepUntil(w, {}, 10, (e) => e.type === 'dropLanded');
    const g = w.drops[0];
    const before = w.animals.filter((a) => a.state === 'field' && !a.golden).map((a) => ({ a, kind: a.kind, x: a.x }));
    hover(w.saucers.red, g.x);
    const e = stepUntil(w, {}, 4, (e) => e.type === 'animalRain');
    return { w, e, before, pennedLamb, gold };
  }

  it('every lamb in the field bursts and a cow parachutes down in its place', () => {
    const { w, e, before, gold } = grab('cowRain');
    const lambs = before.filter((b) => b.kind === 'lamb');
    expect(lambs.length).toBeGreaterThan(0);
    expect(e).toMatchObject({ side: 'red', from: 'lamb', to: 'cow', count: lambs.length + 1, penned: 1 });
    expect(w.events.filter((x) => x.type === 'burst')).toHaveLength(lambs.length + 1);
    for (const { a } of lambs) expect(a.state).toBe('gone');
    const fresh = w.animals.filter((a) => String(a.id).startsWith('rain-') && !a.pen);
    expect(fresh).toHaveLength(lambs.length);
    expect(fresh.every((a) => a.kind === 'cow' && a.state === 'descending')).toBe(true);
    // Cows and golden animals are left alone.
    for (const { a } of before.filter((b) => b.kind === 'cow')) expect(a.state).not.toBe('gone');
    expect(gold.state).not.toBe('gone');
    // Instant: nothing to count down, and the rocket is still held.
    expect(w.powers.red).toMatchObject({ type: 'rocket' });
    run(w, {}, 8);
    expect(fresh.every((a) => a.state === 'field')).toBe(true);
  });

  it('lambs in pens are swapped too, and the new cow counts for that pen at once', () => {
    const { w, pennedLamb } = grab('cowRain');
    expect(pennedLamb.state).toBe('gone');
    const cow = w.animals.find((a) => String(a.id).startsWith('rain-') && a.pen === 'blue');
    expect(cow).toMatchObject({ kind: 'cow', owner: 'blue', state: 'descending' });
    expect(cow.x).toBeGreaterThanOrEqual(ARENA.pens.blue.left);
    expect(scores(w.animals).blue).toBe(2); // a cow instead of a lamb, while still coming down
    run(w, {}, 8);
    expect(cow.state).toBe('penned');
    expect(scores(w.animals).blue).toBe(2);
  });

  it('and the other way round', () => {
    const { w, e, before } = grab('lambRain');
    const cows = before.filter((b) => b.kind === 'cow');
    expect(e).toMatchObject({ from: 'cow', to: 'lamb', count: cows.length });
    expect(w.animals.filter((a) => String(a.id).startsWith('rain-')).every((a) => a.kind === 'lamb')).toBe(true);
  });
});

describe('supply drop', () => {
  /** A round in play with every animal penned and `ammo` shots each. */
  function stalemate(ammo) {
    POWERUP.chance = 0;
    GOLDEN.chance = 0;
    const r = createRound(5);
    r.crates = { red: true, blue: true }; // the early out-of-ammo crates are used up
    while (r.phase !== 'play') stepRound(r, {}, STEP);
    const w = r.world;
    hover(w.saucers.red, 640, 100);
    hover(w.saucers.blue, 700, 100);
    w.animals.forEach((a, i) => Object.assign(a, { state: 'penned', pen: i % 2 ? 'red' : 'blue', owner: i % 2 ? 'red' : 'blue' }));
    w.weapons.red.ammo = ammo.red;
    w.weapons.blue.ammo = ammo.blue;
    return r;
  }

  function collect(r, seconds) {
    const found = [];
    for (let t = 0; t < seconds; t += STEP) {
      stepRound(r, {}, STEP);
      found.push(...r.events.filter((e) => e.type === 'crateIncoming' || e.type === 'dropIncoming'));
    }
    return found;
  }

  it('comes once the field is empty and someone is out of shots', () => {
    const r = stalemate({ red: 0, blue: 5 });
    expect(collect(r, SUPPLY.after - 0.2)).toHaveLength(0);
    const found = collect(r, 0.4);
    expect(found).toHaveLength(1);
    if (found[0].type === 'crateIncoming') expect(found[0].side).toBe('red');
    // Only once while the field stays empty.
    r.world.drops.forEach((d) => (d.state = 'gone'));
    expect(collect(r, SUPPLY.after + 1)).toHaveLength(0);
  });

  it('is sometimes a crate and sometimes a power-up', () => {
    const kinds = new Set();
    for (let i = 0; i < 20; i++) {
      const r = stalemate({ red: 0, blue: 0 });
      r.world.rng = (
        (s) => () =>
          (s = (s * 16807) % 2147483647) / 2147483647
      )(((i + 1) * 97531) % 2147483647);
      kinds.add(collect(r, SUPPLY.after + 0.2)[0]?.type);
    }
    expect([...kinds].sort()).toEqual(['crateIncoming', 'dropIncoming']);
  });

  it('does not come while both players can shoot, or while animals are in the field', () => {
    expect(collect(stalemate({ red: 3, blue: 3 }), SUPPLY.after + 1)).toHaveLength(0);
    const r = stalemate({ red: 0, blue: 3 });
    Object.assign(r.world.animals[0], { state: 'field', pen: null });
    expect(collect(r, SUPPLY.after + 1)).toHaveLength(0);
  });
});
