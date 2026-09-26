import { describe, it, expect, afterEach } from 'vitest';
import { STEP, ARENA, SAUCER, COMBAT, POWERUP, ROUND } from '../src/config.js';
import { createWorld, stepWorld, spawnDrop } from '../src/logic/world.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { planDrop, grantPower } from '../src/logic/powerup.js';
import { clampToPen } from '../src/logic/animal.js';
import { scores } from '../src/logic/scoring.js';
import { speed } from '../src/logic/saucer.js';

const LOW = ARENA.flightBottom - 10;
const chance = POWERUP.chance;
afterEach(() => {
  POWERUP.chance = chance;
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

/** World with the green man standing in the field and both saucers parked high. */
function withGreenMan(power = 'speed') {
  const w = createWorld(3);
  w.saucers.red.y = w.saucers.blue.y = 100;
  spawnDrop(w, power);
  stepUntil(w, {}, 10, (e) => e.type === 'dropLanded');
  return { w, g: w.drops.find((d) => d.kind === 'greenman') };
}

function hover(s, x, y = LOW) {
  Object.assign(s, { x, y, vx: 0, vy: 0 });
}

describe('the drop', () => {
  it('is planned by chance, with one of the four types', () => {
    POWERUP.chance = 1;
    const seen = new Set();
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) seen.add(planDrop(rng));
    expect([...seen].sort()).toEqual([...POWERUP.types].sort());
    POWERUP.chance = 0;
    expect(planDrop(rng)).toBe(null);
  });

  it('falls halfway through the round when planned', () => {
    POWERUP.chance = 1;
    const r = createRound(1);
    let incoming = null;
    let t = 0;
    while (r.phase !== 'over') {
      stepRound(r, {}, STEP);
      if (r.phase === 'play') t += STEP;
      incoming ??= r.events.find((e) => e.type === 'dropIncoming') ? t : null;
    }
    expect(incoming).toBeCloseTo(ROUND.length * POWERUP.dropAt, 1);
    expect(r.world.drops.find((d) => d.kind === 'greenman').power).toBe(r.drop);
  });

  it('never falls when not planned', () => {
    POWERUP.chance = 0;
    const r = createRound(1);
    while (r.phase !== 'over') stepRound(r, {}, STEP);
    expect(r.world.drops.some((d) => d.kind === 'greenman')).toBe(false);
  });

  it('parachutes into the field, then can be grabbed', () => {
    const { w, g } = withGreenMan('laser');
    expect(g.state).toBe('field');
    expect(g.y).toBe(ARENA.groundY);
    expect(g.x).toBeGreaterThan(ARENA.pens.red.right);
    expect(g.x).toBeLessThan(ARENA.pens.blue.left);

    hover(w.saucers.red, g.x);
    const e = stepUntil(w, {}, 2, (e) => e.type === 'powerup');
    expect(e).toMatchObject({ side: 'red', power: 'laser' });
    expect(g.state).toBe('gone');
    expect(w.hooks.red.carrying).toBe(null); // nothing to drop off
    expect(w.powers.red).toMatchObject({ type: 'laser' });
  });

  it('cannot be grabbed while carrying an animal', () => {
    const { w, g } = withGreenMan();
    const red = w.saucers.red;
    const lamb = w.animals.find((a) => a.kind === 'lamb');
    hover(red, lamb.x);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    hover(red, g.x);
    run(w, {}, 1.5);
    expect(g.state).toBe('field');
    expect(w.powers.red).toBe(null);
  });

  it('is dropped by a shot like an animal', () => {
    const { w, g } = withGreenMan();
    const { red, blue } = w.saucers;
    hover(red, g.x);
    hover(blue, g.x + 250);
    const e = stepUntil(w, { blue: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'interrupt');
    expect(e?.reason).toBe('shot');
    expect(stepUntil(w, {}, 2, (e) => e.type === 'dropLanded')).toBeTruthy();
    expect(g.state).toBe('field');
  });
});

describe('power-ups', () => {
  it('last POWERUP.duration seconds', () => {
    const w = createWorld(1);
    grantPower(w.powers, 'blue', 'triple');
    run(w, {}, POWERUP.duration - 0.1);
    expect(w.powers.blue?.type).toBe('triple');
    const e = stepUntil(w, {}, 0.2, (e) => e.type === 'powerEnd');
    expect(e).toMatchObject({ side: 'blue', power: 'triple' });
    expect(w.powers.blue).toBe(null);
  });

  it('speed: flies faster', () => {
    const w = createWorld(1);
    hover(w.saucers.red, 300, 200);
    grantPower(w.powers, 'red', 'speed');
    run(w, { red: { x: 1, y: 0 } }, 0.6);
    expect(speed(w.saucers.red)).toBeGreaterThan(SAUCER.maxSpeed * 1.3);
  });

  it('triple: three shots per press', () => {
    const w = createWorld(1);
    grantPower(w.powers, 'red', 'triple');
    stepWorld(w, { red: { x: 0, y: 0, shoot: true } }, STEP);
    expect(w.projectiles).toHaveLength(3);
    expect(w.projectiles.map((p) => p.y - w.saucers.red.y)).toEqual([-POWERUP.tripleSpread, 0, POWERUP.tripleSpread]);
    expect(w.weapons.red.ammo).toBe(COMBAT.ammoPerRound);
  });

  it('triple: shots are free, and an empty gun reloads', () => {
    const w = createWorld(1);
    Object.assign(w.weapons.red, { clip: 0, ammo: 0 });
    grantPower(w.powers, 'red', 'triple');
    stepUntil(w, {}, 2, (e) => e.type === 'reload');
    expect(w.weapons.red.clip).toBe(COMBAT.clipSize);
    stepWorld(w, { red: { x: 0, y: 0, shoot: true } }, STEP);
    expect(w.projectiles).toHaveLength(3);
    expect(w.weapons.red.ammo).toBe(0);
    // Leftover free shots vanish with the power-up.
    run(w, {}, POWERUP.duration);
    expect(w.powers.red).toBe(null);
    expect(w.weapons.red.clip).toBe(0);
  });

  it('laser: holding shoot pushes the opponent, breaks their pickup and uses no ammo', () => {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    const lamb = w.animals.find((a) => a.kind === 'lamb');
    hover(blue, lamb.x);
    stepWorld(w, {}, STEP);
    expect(w.hooks.blue.target).toBe(lamb);
    hover(red, lamb.x - 300);
    grantPower(w.powers, 'red', 'laser');
    const hold = { red: { x: 0, y: 0, shoot: true, fire: true } };
    stepWorld(w, hold, STEP);
    expect(w.events.map((e) => e.type)).toEqual(expect.arrayContaining(['laserOn', 'hit', 'interrupt']));
    expect(w.projectiles).toHaveLength(0);
    run(w, { red: { x: 0, y: 0, shoot: false, fire: true } }, 0.5);
    expect(blue.x - (lamb.x)).toBeGreaterThan(100);
    expect(w.weapons.red.ammo).toBe(COMBAT.ammoPerRound);
    stepWorld(w, {}, STEP);
    expect(w.events.some((e) => e.type === 'laserOff')).toBe(true);
    expect(w.lasers.red).toBe(null);
  });

  it('laser: misses an opponent at a different height', () => {
    const w = createWorld(1);
    grantPower(w.powers, 'red', 'laser');
    w.saucers.blue.y = w.saucers.red.y + 60;
    stepWorld(w, { red: { x: 0, y: 0, fire: true } }, STEP);
    expect(w.lasers.red.hit).toBe(false);
    expect(w.saucers.blue.vx).toBe(0);
  });
});

describe('powered hits knock a carried animal loose', () => {
  function carrying() {
    const w = createWorld(1);
    const { red, blue } = w.saucers;
    const cow = w.animals.find((a) => a.kind === 'cow');
    hover(blue, cow.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    hover(blue, 900, 300);
    hover(red, 500, 300);
    return { w, cow };
  }

  it('with triple shot', () => {
    const { w, cow } = carrying();
    grantPower(w.powers, 'red', 'triple');
    const e = stepUntil(w, { red: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'knockLoose');
    expect(e).toMatchObject({ side: 'blue', kind: 'cow' });
    expect(w.hooks.blue.carrying).toBe(null);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land')).toMatchObject({ pen: null, delivered: false });
    expect(cow.state).toBe('field');
  });

  it('with the laser', () => {
    const { w } = carrying();
    grantPower(w.powers, 'red', 'laser');
    stepWorld(w, { red: { x: 0, y: 0, fire: true } }, STEP);
    expect(w.events.some((e) => e.type === 'knockLoose')).toBe(true);
    expect(w.hooks.blue.carrying).toBe(null);
  });

  it('but not with ordinary shots', () => {
    const { w } = carrying();
    expect(stepUntil(w, { red: { x: 0, y: 0, shoot: true } }, 1, (e) => e.type === 'hit')).toBeTruthy();
    expect(w.hooks.blue.carrying).not.toBe(null);
  });
});

describe('steal power-up', () => {
  function stealCow(power) {
    const w = createWorld(1);
    w.saucers.blue.y = 100;
    const cow = w.animals.find((a) => a.kind === 'cow');
    Object.assign(cow, { state: 'penned', pen: 'blue', owner: 'blue', x: clampToPen(1190, 'cow', 'blue') });
    const red = w.saucers.red;
    if (power) grantPower(w.powers, 'red', 'steal');
    hover(red, cow.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    red.x = 90;
    const land = stepUntil(w, {}, 2, (e) => e.type === 'land');
    return { w, cow, land };
  }

  it('makes a stolen animal worth double full value', () => {
    const { w, land } = stealCow(true);
    expect(land).toMatchObject({ pen: 'red', stolen: true, bonus: true, value: 4 });
    expect(scores(w.animals).red).toBe(4);
  });

  it('without it, a stolen animal is still worth half', () => {
    const { w, land } = stealCow(false);
    expect(land).toMatchObject({ bonus: false, value: 1 });
    expect(scores(w.animals).red).toBe(1);
  });

  it('keeps the bonus after the power-up ends, and loses it when lifted out again', () => {
    const { w, cow } = stealCow(true);
    run(w, {}, POWERUP.duration + 1);
    expect(scores(w.animals).red).toBe(4);
    hover(w.saucers.red, 600, 100);
    const blue = w.saucers.blue;
    hover(blue, cow.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    expect(cow.bonus).toBe(false);
    blue.x = 1190;
    stepUntil(w, {}, 2, (e) => e.type === 'land');
    expect(scores(w.animals)).toEqual({ red: 0, blue: 2 });
  });

  it('counts the steal even if the power-up runs out before delivery', () => {
    const w = createWorld(1);
    w.saucers.blue.y = 100;
    const cow = w.animals.find((a) => a.kind === 'cow');
    Object.assign(cow, { state: 'penned', pen: 'blue', owner: 'blue', x: clampToPen(1190, 'cow', 'blue') });
    grantPower(w.powers, 'red', 'steal');
    w.powers.red.timeLeft = 1.8; // expires right after the 1.6 s lift
    hover(w.saucers.red, cow.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    run(w, {}, 1);
    expect(w.powers.red).toBe(null);
    w.saucers.red.x = 90;
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land')).toMatchObject({ bonus: true, value: 4 });
  });

  it('does not boost ordinary deliveries', () => {
    const w = createWorld(1);
    w.saucers.blue.y = 100;
    const cow = w.animals.find((a) => a.kind === 'cow');
    grantPower(w.powers, 'red', 'steal');
    hover(w.saucers.red, cow.x);
    stepUntil(w, {}, 3, (e) => e.type === 'pickup');
    w.saucers.red.x = 90;
    expect(stepUntil(w, {}, 2, (e) => e.type === 'land')).toMatchObject({ value: 2, bonus: false });
  });
});
