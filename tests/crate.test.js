import { describe, it, expect, afterEach } from 'vitest';
import { STEP, COMBAT, ROUND, AMMO_CRATE, POWERUP, GOLDEN } from '../src/config.js';
import { createWorld, spawnCrate } from '../src/logic/world.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { stepUntil, hover } from './helpers.js';

const saved = { power: POWERUP.chance, golden: GOLDEN.chance };
afterEach(() => {
  POWERUP.chance = saved.power;
  GOLDEN.chance = saved.golden;
});

/** Play a round with no other drops; `each(r, t)` runs every play step. */
function playRound(each) {
  POWERUP.chance = 0;
  GOLDEN.chance = 0;
  const r = createRound(4);
  const crates = [];
  let t = 0;
  while (r.phase !== 'over') {
    stepRound(r, {}, STEP);
    if (r.phase !== 'play') continue;
    t += STEP;
    each(r, t);
    for (const e of r.events) if (e.type === 'crateIncoming') crates.push({ ...e, t });
  }
  return crates;
}

const empty = (r, side) => Object.assign(r.world.weapons[side], { ammo: 0, clip: 0 });

describe('ammo crate drop', () => {
  it('drops when a player runs out before the cut-off', () => {
    const crates = playRound((r, t) => {
      if (t > 10 && t < 10.1) empty(r, 'red');
    });
    expect(crates).toHaveLength(1);
    expect(crates[0].side).toBe('red');
    expect(crates[0].t).toBeCloseTo(10, 1);
  });

  it('does not drop after the cut-off', () => {
    const cutoff = ROUND.length * AMMO_CRATE.before;
    const crates = playRound((r, t) => {
      if (t > cutoff + 1) empty(r, 'red');
    });
    expect(crates).toHaveLength(0);
  });

  it('drops once per player, and one at a time', () => {
    const crates = playRound((r, t) => {
      if (t > 5) empty(r, 'red'); // red stays empty
      if (t > 6) empty(r, 'blue'); // blue runs out while red's crate is still around
      // Red's crate is taken (by nobody in particular) at 15 s.
      if (t > 15 && t < 15.1) r.world.drops.forEach((d) => (d.state = 'gone'));
    });
    expect(crates.map((c) => c.side)).toEqual(['red', 'blue']);
    expect(crates[1].t).toBeGreaterThan(15);
  });
});

describe('ammo crate pickup', () => {
  function withCrate() {
    const w = createWorld(2);
    hover(w.saucers.red, 300, 100);
    hover(w.saucers.blue, 1000, 100);
    spawnCrate(w, 'red');
    stepUntil(w, {}, 10, (e) => e.type === 'dropLanded');
    return { w, c: w.drops[0] };
  }

  it('sits still once landed', () => {
    const { w, c } = withCrate();
    const x = c.x;
    stepUntil(w, {}, 3, () => false);
    expect(c.x).toBe(x);
  });

  it('refills an empty gun, which then reloads', () => {
    const { w, c } = withCrate();
    Object.assign(w.weapons.red, { ammo: 0, clip: 0 });
    hover(w.saucers.red, c.x);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'ammoCrate')).toMatchObject({ side: 'red' });
    expect(c.state).toBe('gone');
    expect(w.hooks.red.carrying).toBe(null);
    expect(w.weapons.red.ammo).toBe(AMMO_CRATE.refill);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'reload')).toBeTruthy();
    expect(w.weapons.red.clip).toBe(COMBAT.clipSize);
  });

  it('can be taken by the other player, up to the ammo cap', () => {
    const { w, c } = withCrate();
    w.weapons.blue.ammo = COMBAT.ammoPerRound - 2;
    hover(w.saucers.blue, c.x);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'ammoCrate')).toMatchObject({ side: 'blue' });
    expect(w.weapons.blue.ammo).toBe(COMBAT.ammoPerRound);
  });

  it('cannot be grabbed while carrying an animal', () => {
    const { w, c } = withCrate();
    const red = w.saucers.red;
    const lamb = w.animals.find((a) => a.kind === 'lamb');
    hover(red, lamb.x);
    stepUntil(w, {}, 2, (e) => e.type === 'pickup');
    hover(red, c.x);
    stepUntil(w, {}, 1.5, () => false);
    expect(c.state).toBe('field');
  });
});
